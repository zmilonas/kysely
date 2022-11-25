import type {
  AliasedExpressionOrFactory,
  ExpressionOrFactory,
} from '../expression/expression.js'
import { AliasNode } from '../operation-node/alias-node.js'
import { isOperationNodeSource } from '../operation-node/operation-node-source.js'
import { OperationNode } from '../operation-node/operation-node.js'
import { createExpressionBuilder } from '../query-builder/expression-builder.js'
import { isFunction } from '../util/object-utils.js'

export function parseExpression(
  exp: ExpressionOrFactory<any, any, any>
): OperationNode {
  if (isOperationNodeSource(exp)) {
    return exp.toOperationNode()
  } else if (isFunction(exp)) {
    return exp(createExpressionBuilder()).toOperationNode()
  }

  throw new Error(`invalid expression: ${JSON.stringify(exp)}`)
}

export function parseAliasedExpression(
  exp: AliasedExpressionOrFactory<any, any>
): AliasNode {
  if (isOperationNodeSource(exp)) {
    return exp.toOperationNode()
  } else if (isFunction(exp)) {
    return exp(createExpressionBuilder()).toOperationNode()
  }

  throw new Error(`invalid aliased expression: ${JSON.stringify(exp)}`)
}
