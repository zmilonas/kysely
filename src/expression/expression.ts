import { AliasNode } from '../operation-node/alias-node.js'
import {
  isOperationNodeSource,
  OperationNodeSource,
} from '../operation-node/operation-node-source.js'
import { OperationNode } from '../operation-node/operation-node.js'
import type { ExpressionBuilder } from '../query-builder/expression-builder.js'
import type { SelectQueryBuilder } from '../query-builder/select-query-builder.js'
import { isFunction, isObject, isString } from '../util/object-utils.js'

/**
 * `Expression` represents an arbitrary SQL expression with a type.
 *
 * Most Kysely methods accept instances of `Expression` and most classes like `SelectQueryBuilder`
 * and the return value of the {@link sql} template tag implement it.
 *
 * ```ts
 * const exp1: Expression<string> = sql<string>`CONCAT('hello', ' ', 'world')`
 * const exp2: Expression<{ first_name: string }> = db.selectFrom('person').select('first_name')
 * ```
 *
 * You can implement the `Expression` interface to create your own type-safe utilities for Kysely.
 */
export interface Expression<T> extends OperationNodeSource {
  /**
   * All expressions need to have this getter for complicated type-related reasons.
   * Simply add this getter for your expression and always return `undefined` from it:
   *
   * ```ts
   * class SomeExpression<T> implements Expression<T> {
   *   get expressionType(): T | undefined {
   *     return undefined
   *   }
   * }
   * ```
   *
   * The getter is needed to make the expression assignable to another expression only
   * if the types `T` are assignable. Without this property (or some other property
   * that references `T`), you could assing `Expression<string>` to `Expression<number>`.
   */
  get expressionType(): T | undefined

  /**
   * Creates the OperationNode that describes how to compile this expression into SQL.
   *
   * If you are creating a custom expression, it's often easiest to use the {@link sql}
   * template tag to build the node:
   *
   * ```ts
   * class SomeExpression<T> implements Expression<T> {
   *   toOperationNode(): OperationNode {
   *     return sql`some sql here`.toOperationNode()
   *   }
   * }
   * ```
   */
  toOperationNode(): OperationNode
}

/**
 * Just like `Expression<T>` but also holds an alias type `A`.
 *
 * `AliasedExpression<T, A>` can be used in places where, in addition to the value type `T`, you
 * also need a name `A` for that value. For example anything you can pass into the `select` method
 * needs to implement an `AliasedExpression<T, A>`. `A` becomes the name of the selected expression
 * in the result and `T` becomes its type.
 *
 * @example
 *
 * ```ts
 * class SomeAliasedExpression<T, A extends string> implements AliasedExpression<T, A> {
 *   #expression: Expression<T>
 *   #alias: A
 *
 *   constructor(expression: Expression<T>, alias: A) {
 *     this.#expression = expression
 *     this.#alias = alias
 *   }
 *
 *   get expression(): Expression<T> {
 *     return this.#expression
 *   }
 *
 *   get alias(): A {
 *     return this.#alias
 *   }
 *
 *   toOperationNode(): AliasNode {
 *     return AliasNode.create(this.#expression.toOperationNode(), IdentifierNode.create(this.#alias))
 *   }
 * }
 * ```
 */
export interface AliasedExpression<T, A extends string>
  extends OperationNodeSource {
  /**
   * Returns the aliased expression.
   */
  get expression(): Expression<T>

  /**
   * Returns the alias.
   */
  get alias(): A

  /**
   * Creates the OperationNode that describes how to compile this expression into SQL.
   */
  toOperationNode(): AliasNode
}

export function isExpression(obj: unknown): obj is Expression<any> {
  return isObject(obj) && 'expressionType' in obj && isOperationNodeSource(obj)
}

export function isAliasedExpression(
  obj: unknown
): obj is AliasedExpression<any, any> {
  return (
    isObject(obj) &&
    'expression' in obj &&
    isString(obj.alias) &&
    isOperationNodeSource(obj)
  )
}

export type ExpressionOrFactory<DB, TB extends keyof DB, V> =
  // SQL treats a subquery with a single selection as a scalar. That's
  // why we need to explicitly allow `SelectQueryBuilder` here with a
  // `Record<string, V>` output type, even though `SelectQueryBuilder`
  // is also an `Expression`.
  | SelectQueryBuilder<any, any, Record<string, V>>
  | ((
      eb: ExpressionBuilder<DB, TB>
    ) => SelectQueryBuilder<any, any, Record<string, V>>)
  | Expression<V>
  | ((eb: ExpressionBuilder<DB, TB>) => Expression<V>)

export type AliasedExpressionOrFactory<DB, TB extends keyof DB> =
  | AliasedExpression<any, any>
  | ((qb: ExpressionBuilder<DB, TB>) => AliasedExpression<any, any>)

export function isExpressionOrFactory(
  obj: unknown
): obj is ExpressionOrFactory<any, any, any> {
  return isExpression(obj) || isFunction(obj)
}
