import { AliasNode } from '../../operation-node/alias-node.js'
import { OperationNodeTransformer } from '../../operation-node/operation-node-transformer.js'
import { TableExpressionNode } from '../../operation-node/operation-node-utils.js'
import { OperationNode } from '../../operation-node/operation-node.js'
import { SchemableIdentifierNode } from '../../operation-node/schemable-identifier-node.js'
import { TableNode } from '../../operation-node/table-node.js'
import { WithNode } from '../../operation-node/with-node.js'
import { RootOperationNode } from '../../query-compiler/query-compiler.js'
import { freeze } from '../../util/object-utils.js'

// This object exist only so that we get a type error when a new RootOperationNode
// is added. If you get a type error here, make sure to add the new root node and
// handle it correctly in the transformer.
//
// DO NOT REFACTOR THIS EVEN IF IT SEEMS USELESS TO YOU!
const ROOT_OPERATION_NODES: Record<RootOperationNode['kind'], true> = freeze({
  AlterTableNode: true,
  CreateIndexNode: true,
  CreateSchemaNode: true,
  CreateTableNode: true,
  CreateTypeNode: true,
  CreateViewNode: true,
  DeleteQueryNode: true,
  DropIndexNode: true,
  DropSchemaNode: true,
  DropTableNode: true,
  DropTypeNode: true,
  DropViewNode: true,
  InsertQueryNode: true,
  RawNode: true,
  SelectQueryNode: true,
  UpdateQueryNode: true,
})

export class WithSchemaTransformer extends OperationNodeTransformer {
  readonly #schema: string
  readonly #schemableIds = new Set<string>()

  constructor(schema: string) {
    super()
    this.#schema = schema
  }

  protected override transformNodeImpl<T extends OperationNode>(node: T): T {
    if (!this.#isRootOperationNode(node)) {
      return super.transformNodeImpl(node)
    }

    const tables = this.#collectSchemableIds(node)

    for (const table of tables) {
      this.#schemableIds.add(table)
    }

    const transformed = super.transformNodeImpl(node)

    for (const table of tables) {
      this.#schemableIds.delete(table)
    }

    return transformed
  }

  protected override transformSchemableIdentifier(
    node: SchemableIdentifierNode
  ): SchemableIdentifierNode {
    const transformed = super.transformSchemableIdentifier(node)

    if (transformed.schema || !this.#schemableIds.has(node.identifier.name)) {
      return transformed
    }

    return {
      ...transformed,
      schema: freeze({
        kind: 'IdentifierNode',
        name: this.#schema,
      }),
    }
  }

  #isRootOperationNode(node: OperationNode): node is RootOperationNode {
    return node.kind in ROOT_OPERATION_NODES
  }

  #collectSchemableIds(node: RootOperationNode): Set<string> {
    const schemableIds = new Set<string>()

    if ('name' in node && node.name && SchemableIdentifierNode.is(node.name)) {
      this.#collectSchemableId(node.name, schemableIds)
    }

    if ('from' in node && node.from) {
      for (const from of node.from.froms) {
        this.#collectSchemableIdsFromTableExpr(from, schemableIds)
      }
    }

    if ('into' in node && node.into) {
      this.#collectSchemableIdsFromTableExpr(node.into, schemableIds)
    }

    if ('table' in node && node.table) {
      this.#collectSchemableIdsFromTableExpr(node.table, schemableIds)
    }

    if ('joins' in node && node.joins) {
      for (const join of node.joins) {
        this.#collectSchemableIdsFromTableExpr(join.table, schemableIds)
      }
    }

    if ('with' in node && node.with) {
      this.#removeCommonTableExpressionTables(node.with, schemableIds)
    }

    return schemableIds
  }

  #collectSchemableIdsFromTableExpr(
    node: TableExpressionNode,
    schemableIds: Set<string>
  ): void {
    const table = TableNode.is(node)
      ? node
      : AliasNode.is(node) && TableNode.is(node.node)
      ? node.node
      : null

    if (table) {
      this.#collectSchemableId(table.table, schemableIds)
    }
  }

  #collectSchemableId(
    node: SchemableIdentifierNode,
    schemableIds: Set<string>
  ): void {
    if (!this.#schemableIds.has(node.identifier.name)) {
      schemableIds.add(node.identifier.name)
    }
  }

  #removeCommonTableExpressionTables(
    node: WithNode,
    schemableIds: Set<string>
  ) {
    for (const expr of node.expressions) {
      schemableIds.delete(expr.name.table.table.identifier.name)
    }
  }
}
