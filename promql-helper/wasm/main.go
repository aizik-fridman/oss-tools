package main

import (
	"encoding/json"
	"fmt"
	"syscall/js"

	"github.com/prometheus/prometheus/promql/parser"
)

type NodeInfo struct {
	Type        string     `json:"type"`
	Expr        string     `json:"expr"`
	Explanation string     `json:"explanation"`
	Children    []NodeInfo `json:"children,omitempty"`
}

func parsePromQL(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return errorResponse("No query provided")
	}

	query := args[0].String()

	// Create a new parser instance and parse the query
	p := parser.NewParser(parser.Options{})
	expr, err := p.ParseExpr(query)
	if err != nil {
		return errorResponse(err.Error())
	}

	// Format the query (the String() method of expr nicely formats it)
	formatted := expr.String()

	// Build AST explanation
	explanation := walkTree(expr)

	// Basic Linting
	warnings := lintTree(expr)

	result := map[string]interface{}{
		"formatted":   formatted,
		"explanation": explanation,
		"warnings":    warnings,
		"error":       "",
	}

	// Serialize result to JSON string to return to JS
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return errorResponse("Failed to serialize result")
	}

	return string(jsonBytes)
}

func errorResponse(errMsg string) interface{} {
	res := map[string]interface{}{
		"error": errMsg,
	}
	b, _ := json.Marshal(res)
	return string(b)
}

func walkTree(node parser.Node) NodeInfo {
	if node == nil {
		return NodeInfo{}
	}

	info := NodeInfo{
		Type: fmt.Sprintf("%T", node),
		Expr: node.String(),
	}

	switch n := node.(type) {
	case *parser.VectorSelector:
		info.Type = "VectorSelector"
		info.Explanation = fmt.Sprintf("Selects metric '%s' with label filters", n.Name)
	case *parser.MatrixSelector:
		info.Type = "MatrixSelector"
		info.Explanation = fmt.Sprintf("Selects a range vector over a duration of %v", n.Range)
		info.Children = append(info.Children, walkTree(n.VectorSelector))
	case *parser.Call:
		info.Type = "FunctionCall"
		info.Explanation = fmt.Sprintf("Calls function '%s'", n.Func.Name)
		for _, arg := range n.Args {
			info.Children = append(info.Children, walkTree(arg))
		}
	case *parser.AggregateExpr:
		info.Type = "Aggregation"
		info.Explanation = fmt.Sprintf("Aggregates using '%s'", n.Op)
		info.Children = append(info.Children, walkTree(n.Expr))
	case *parser.BinaryExpr:
		info.Type = "BinaryOperation"
		info.Explanation = fmt.Sprintf("Performs '%s' operation", n.Op)
		info.Children = append(info.Children, walkTree(n.LHS), walkTree(n.RHS))
	case *parser.ParenExpr:
		info.Type = "ParenExpr"
		info.Explanation = "Parentheses for grouping"
		info.Children = append(info.Children, walkTree(n.Expr))
	case *parser.NumberLiteral:
		info.Type = "NumberLiteral"
		info.Explanation = fmt.Sprintf("Literal value: %v", n.Val)
	case *parser.StringLiteral:
		info.Type = "StringLiteral"
		info.Explanation = fmt.Sprintf("Literal string: %v", n.Val)
	case *parser.SubqueryExpr:
		info.Type = "SubqueryExpr"
		info.Explanation = fmt.Sprintf("Executes a subquery with range %v and step %v", n.Range, n.Step)
		info.Children = append(info.Children, walkTree(n.Expr))
	case *parser.UnaryExpr:
		info.Type = "UnaryExpr"
		info.Explanation = fmt.Sprintf("Applies unary operator '%s'", n.Op)
		info.Children = append(info.Children, walkTree(n.Expr))
	default:
		info.Explanation = "Evaluates an expression"
	}

	return info
}

func lintTree(node parser.Node) []string {
	var warnings []string
	
	// A simple walk mechanism for linting
	var walk func(n parser.Node)
	walk = func(n parser.Node) {
		if n == nil {
			return
		}

		switch expr := n.(type) {
		case *parser.Call:
			if expr.Func != nil {
				name := expr.Func.Name
				// e.g., rate() and irate() require MatrixSelector
				if name == "rate" || name == "irate" || name == "increase" || name == "deriv" || name == "predict_linear" {
					if len(expr.Args) > 0 {
						if _, isMatrix := expr.Args[0].(*parser.MatrixSelector); !isMatrix {
							warnings = append(warnings, fmt.Sprintf("Function %s() expects a range vector (e.g. metric[5m]), but got a different type.", name))
						}
					}
				}
			}
			for _, arg := range expr.Args {
				walk(arg)
			}
		case *parser.MatrixSelector:
			walk(expr.VectorSelector)
		case *parser.AggregateExpr:
			walk(expr.Expr)
		case *parser.BinaryExpr:
			if expr.VectorMatching != nil && len(expr.VectorMatching.MatchingLabels) == 0 && !expr.VectorMatching.On {
				// E.g. ignoring() without labels is valid but maybe we want to flag binary ops lacking on/ignoring entirely if they have labels, but it's complex.
				// For this example, let's just warn if we see an operator that normally requires vector matching but has none configured.
				// Since PromQL parser defaults On to false when no matching is specified (e.g., foo / bar), we can warn about missing vector matching.
				// This is a naive warning just to satisfy the user's request.
				if _, leftVec := expr.LHS.(*parser.VectorSelector); leftVec {
					if _, rightVec := expr.RHS.(*parser.VectorSelector); rightVec {
						warnings = append(warnings, fmt.Sprintf("Binary operation '%s' between two vectors might require on() or ignoring() if their labels don't match exactly.", expr.Op))
					}
				}
			}
			walk(expr.LHS)
			walk(expr.RHS)
		case *parser.ParenExpr:
			walk(expr.Expr)
		case *parser.SubqueryExpr:
			walk(expr.Expr)
		case *parser.UnaryExpr:
			walk(expr.Expr)
		}
	}

	walk(node)
	return warnings
}

func main() {
	// Expose the parsePromQL function to global JS context
	js.Global().Set("parsePromQL", js.FuncOf(parsePromQL))

	// Keep the Wasm program running
	select {}
}
