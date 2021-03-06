import {ObjectLiteral} from "../common/ObjectLiteral";
import {EntityMetadata} from "../metadata/EntityMetadata";
import {ColumnMetadata} from "../metadata/ColumnMetadata";
import {RelationMetadata} from "../metadata/RelationMetadata";
import {ColumnTypes} from "../metadata/types/ColumnTypes";
import {DataTransformationUtils} from "../util/DataTransformationUtils";

/**
 * Holds information about insert operation into junction table.
 */
export interface JunctionInsert {

    /**
     * Relation of the junction table.
     */
    relation: RelationMetadata;

    /**
     * Entities that needs to be "bind" to the subject.
     */
    junctionEntities: ObjectLiteral[];
}

/**
 * Holds information about remove operation from the junction table.
 */
export interface JunctionRemove {

    /**
     * Relation of the junction table.
     */
    relation: RelationMetadata;

    /**
     * Entity ids that needs to be removed from the junction table.
     */
    junctionRelationIds: any[];
}

/**
 * Holds information about relation update in some subject.
 */
export interface RelationUpdate {

    /**
     * Relation that needs to be updated.
     */
    relation: RelationMetadata;

    /**
     * New value that needs to be set into into new relation.
     */
    value: any;
}

/**
 * Subject is a subject of persistence.
 * It holds information about each entity that needs to be persisted:
 * - what entity should be persisted
 * - what is database representation of the persisted entity
 * - what entity metadata of the persisted entity
 * - what is allowed to with persisted entity (insert/update/remove)
 *
 * Having this collection of subjects we can perform database queries.
 */
export class Subject {

    // -------------------------------------------------------------------------
    // Private Properties
    // -------------------------------------------------------------------------

    /**
     * Persist entity (changed entity).
     */
    private _persistEntity?: ObjectLiteral;

    /**
     * Database entity.
     */
    private _databaseEntity?: ObjectLiteral;

    // -------------------------------------------------------------------------
    // Public Readonly Properties
    // -------------------------------------------------------------------------

    /**
     * Entity metadata of the subject entity.
     */
    readonly metadata: EntityMetadata;

    /**
     * Date when this entity is persisted.
     */
    readonly date: Date = new Date();

    // -------------------------------------------------------------------------
    // Public Properties
    // -------------------------------------------------------------------------

    /**
     * Indicates if this subject can be inserted into the database.
     * This means that this subject either is newly persisted, either can be inserted by cascades.
     */
    canBeInserted: boolean = false;

    /**
     * Indicates if this subject can be updated in the database.
     * This means that this subject either was persisted, either can be updated by cascades.
     */
    canBeUpdated: boolean = false;

    /**
     * Indicates if this subject MUST be removed from the database.
     * This means that this subject either was removed, either was removed by cascades.
     */
    mustBeRemoved: boolean = false;

    /**
     * Differentiated columns between persisted and database entities.
     */
    diffColumns: ColumnMetadata[] = [];

    /**
     * Differentiated relations between persisted and database entities.
     */
    diffRelations: RelationMetadata[] = [];

    /**
     * List of relations which need to be unset.
     * This is used to update relation from inverse side.
     */
    relationUpdates: RelationUpdate[] = [];

    /**
     * Records that needs to be inserted into the junction tables of this subject.
     */
    junctionInserts: JunctionInsert[] = [];

    /**
     * Records that needs to be removed from the junction tables of this subject.
     */
    junctionRemoves: JunctionRemove[] = [];

    /**
     * When subject is newly persisted it may have a generated entity id.
     * In this case it should be written here.
     */
    newlyGeneratedId?: any;

    /**
     * Generated id of the parent entity. Used in the class-table-inheritance.
     */
    parentGeneratedId?: any;

    /**
     * Used in newly persisted entities which are tree tables.
     */
    treeLevel?: number;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(metadata: EntityMetadata, entity?: ObjectLiteral, databaseEntity?: ObjectLiteral) {
        this.metadata = metadata;
        this._persistEntity = entity;
        this._databaseEntity = databaseEntity;
    }

    // -------------------------------------------------------------------------
    // Accessors
    // -------------------------------------------------------------------------

    /**
     * Gets entity sent to the persistence (e.g. changed entity).
     * Throws error if persisted entity was not set.
     */
    get entity(): ObjectLiteral {
        if (!this._persistEntity)
            throw new Error(`Persistence entity is not set for the given subject.`);

        return this._persistEntity;
    }

    /**
     * Checks if subject has a persisted entity.
     */
    get hasEntity(): boolean {
        return !!this._persistEntity;
    }

    /**
     * Gets entity from the database (e.g. original entity).
     * Throws error if database entity was not set.
     */
    get databaseEntity(): ObjectLiteral {
        if (!this._databaseEntity)
            throw new Error(`Database entity is not set for the given subject.`);

        return this._databaseEntity;
    }

    /**
     * Checks if subject has a database entity.
     */
    get hasDatabaseEntity(): boolean {
        return !!this._databaseEntity;
    }

    /**
     * Sets entity from the database (e.g. original entity).
     * Once database entity set it calculates differentiated columns and relations
     * between persistent entity and database entity.
     */
    set databaseEntity(databaseEntity: ObjectLiteral) {
        this._databaseEntity = databaseEntity;
        if (this.hasEntity && databaseEntity) {
            this.diffColumns = this.buildDiffColumns();
            this.diffRelations = this.buildDiffRelationalColumns();
        }
    }

    /**
     * Gets entity target from the entity metadata of this subject.
     */
    get entityTarget(): Function|string {
        return this.metadata.target;
    }

    /**
     * Checks if this subject must be inserted into the database.
     * Subject can be inserted into the database if it is allowed to be inserted (explicitly persisted or by cascades)
     * and if it does not have database entity set.
     */
    get mustBeInserted() {
        return this.canBeInserted && !this.hasDatabaseEntity;
    }

    /**
     * Checks if this subject must be updated into the database.
     * Subject can be updated in the database if it is allowed to be updated (explicitly persisted or by cascades)
     * and if it does have differentiated columns or relations.
     */
    get mustBeUpdated() {
        return this.canBeUpdated && (this.diffColumns.length > 0 || this.diffRelations.length > 0);
    }

    /**
     * Checks if this subject has relations to be updated.
     */
    get hasRelationUpdates(): boolean {
        return this.relationUpdates.length > 0;
    }

    /**
     * Gets id of the persisted entity.
     * If entity is not set then it returns undefined.
     * If entity itself has an id then it simply returns it.
     * If entity does not have an id then it returns newly generated id.

    get getPersistedEntityIdMap(): any|undefined {
        if (!this.hasEntity)
            return undefined;

        const entityIdMap = this.metadata.getDatabaseEntityIdMap(this.entity);
        if (entityIdMap)
            return entityIdMap;

        if (this.newlyGeneratedId)
            return this.metadata.createSimpleDatabaseIdMap(this.newlyGeneratedId);

        return undefined;
    }*/

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Validates this subject for errors.
     * Subject cannot be at the same time inserted and updated, removed and inserted, removed and updated.
     */
    validate() {

        if (this.mustBeInserted && this.mustBeRemoved)
            throw new Error(`Removed entity ${this.metadata.name} is also scheduled for insert operation. This looks like ORM problem. Please report a github issue.`);

        if (this.mustBeUpdated && this.mustBeRemoved)
            throw new Error(`Removed entity "${this.metadata.name}" is also scheduled for update operation. ` +
                `Make sure you are not updating and removing same object (note that update or remove may be executed by cascade operations).`);

        if (this.mustBeInserted && this.mustBeUpdated)
            throw new Error(`Inserted entity ${this.metadata.name} is also scheduled for updated operation. This looks like ORM problem. Please report a github issue.`);

    }

    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------

    /**
     * Differentiate columns from the updated entity and entity stored in the database.
     */
    protected buildDiffColumns(): ColumnMetadata[] {
        return this.metadata.allColumns.filter(column => {

            // prepare both entity and database values to make comparision
            let entityValue = column.getEntityValue(this.entity);
            let databaseValue = column.getEntityValue(this.databaseEntity);

            // normalize special values to make proper comparision
            if (entityValue !== null && entityValue !== undefined) {
                if (column.type === ColumnTypes.DATE) {
                    entityValue = DataTransformationUtils.mixedDateToDateString(entityValue);

                } else if (column.type === ColumnTypes.TIME) {
                    entityValue = DataTransformationUtils.mixedDateToTimeString(entityValue);

                } else if (column.type === ColumnTypes.DATETIME) {
                    if (column.loadInLocalTimezone) {
                        entityValue = DataTransformationUtils.mixedDateToDatetimeString(entityValue);
                        databaseValue = DataTransformationUtils.mixedDateToDatetimeString(databaseValue);
                    } else {
                        entityValue = DataTransformationUtils.mixedDateToUtcDatetimeString(entityValue);
                        databaseValue = DataTransformationUtils.mixedDateToUtcDatetimeString(databaseValue);
                    }

                } else if (column.type === ColumnTypes.JSON) {
                    entityValue = JSON.stringify(entityValue);
                    if (databaseValue !== null && databaseValue !== undefined)
                        databaseValue = JSON.stringify(databaseValue);

                } else if (column.type === ColumnTypes.SIMPLE_ARRAY) {
                    entityValue = DataTransformationUtils.simpleArrayToString(entityValue);
                    databaseValue = DataTransformationUtils.simpleArrayToString(databaseValue);
                }
            }

            // if value is not defined then no need to update it
            if (!column.isInEmbedded && this.entity[column.propertyName] === undefined)
                return false;

            // if value is in embedded and is not defined then no need to update it
            if (column.isInEmbedded && (this.entity[column.embeddedProperty] === undefined || this.entity[column.embeddedProperty][column.propertyName] === undefined))
                return false;

            // if its a special column or value is not changed - then do nothing
            if (column.isVirtual ||
                column.isParentId ||
                column.isDiscriminator ||
                column.isUpdateDate ||
                column.isVersion ||
                column.isCreateDate ||
                entityValue === databaseValue)
                return false;

            // filter out "relational columns" only in the case if there is a relation object in entity
            if (!column.isInEmbedded && this.metadata.hasRelationWithDbName(column.propertyName)) {
                const relation = this.metadata.findRelationWithDbName(column.propertyName); // todo: why with dbName ?
                if (this.entity[relation.propertyName] !== null && this.entity[relation.propertyName] !== undefined)
                    return false;
            }

            return true;
        });
    }

    /**
     * Difference columns of the owning one-to-one and many-to-one columns.
     */
    protected buildDiffRelationalColumns(/*todo: updatesByRelations: UpdateByRelationOperation[], */): RelationMetadata[] {
        return this.metadata.allRelations.filter(relation => {
            if (!relation.isManyToOne && !(relation.isOneToOne && relation.isOwning))
                return false;

            // here we cover two scenarios:
            // 1. related entity can be another entity which is natural way
            // 2. related entity can be entity id which is hacked way of updating entity
            // todo: what to do if there is a column with relationId? (cover this too?)
            const updatedEntityRelationId: any =
                this.entity[relation.propertyName] instanceof Object ?
                    relation.inverseEntityMetadata.getEntityIdMixedMap(this.entity[relation.propertyName])
                    : this.entity[relation.propertyName];


            // here because we have enabled RELATION_ID_VALUES option in the QueryBuilder when we loaded db entities
            // we have in the dbSubject only relationIds.
            // this allows us to compare relation id in the updated subject with id in the database.
            // note that we used relation.name instead of relation.propertyName because query builder with RELATION_ID_VALUES
            // returns values in the relation.name column, not relation.propertyName column
            const dbEntityRelationId = this.databaseEntity[relation.name];

            // todo: try to find if there is update by relation operation - we dont need to generate update relation operation for this
            // todo: if (updatesByRelations.find(operation => operation.targetEntity === this && operation.updatedRelation === relation))
            // todo:     return false;

            // we don't perform operation over undefined properties
            if (updatedEntityRelationId === undefined)
                return false;

            // if both are empty totally no need to do anything
            if ((updatedEntityRelationId === undefined || updatedEntityRelationId === null) &&
                (dbEntityRelationId === undefined || dbEntityRelationId === null))
                return false;

            // if relation ids aren't equal then we need to update them
            return updatedEntityRelationId !== dbEntityRelationId;
        });
    }

}