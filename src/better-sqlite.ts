// eslint-disable-next-line @typescript-eslint/triple-slash-reference, spaced-comment
/// <reference path="../node_modules/tns-platform-declarations/android.d.ts" />

import * as app from "@nativescript/core/application";

// Alias the long name:
const SqliteDatabase = android.database.sqlite.SQLiteDatabase;
type SqliteDatabaseType = android.database.sqlite.SQLiteDatabase;
type SqliteStatementType = android.database.sqlite.SQLiteStatement;
const SqliteCursor = android.database.Cursor;
type SqliteCursorType = android.database.Cursor;

/**
 * A row is an object with the row names as keys for the values.
 */
type Row = object;

/**
 * An iterator for rows.
 */
class RowIterator implements Iterator<Row>, Iterable<Row>
{
    private readonly initialCursorPosition = -1;

    private cursor: SqliteCursorType;

    private closed: boolean;

    /**
     * If true the cursor is automatically closed after the iterator has been completed or getFirst/getLast has been called. \
     * Attention: If you set this to false you must call the close method manually!
     */
    public autoClose: boolean;

    public constructor (cursor: SqliteCursorType)
    {
        this.cursor = cursor;

        this.autoClose = true;
        this.closed = false;
    }

    public [Symbol.iterator] (): RowIterator
    {
        return this;
    }

    /**
     * Get the next iterator result.
     * The cursor will be closed when the last result is returned.
     */
    public next (): IteratorResult<Row>
    {
        if (this.closed)
        {
            return {
                done: true,
                value: null,
            };
        }
        else if (this.cursor.moveToNext())
        {
            const row = this.getCurrentRow();

            return {
                done: false,
                value: row,
            };
        }
        else
        {
            if (this.autoClose)
            {
                this.closed = true;
                this.cursor.close();
            }
            else
            {
                this.cursor.moveToPosition(this.initialCursorPosition);
            }

            return {
                done: true,
                value: null,
            };
        }
    }

    /**
     * Get the first row of the result set.
     */
    public getFirst (): Row
    {
        const previousPosition = this.cursor.getPosition();

        this.cursor.moveToFirst();

        const row = this.getCurrentRow();

        this.cursor.moveToPosition(previousPosition);

        if (this.autoClose)
        {
            this.closed = true;
            this.cursor.close();
        }

        return row;
    }

    /**
     * Get the last row of the result set.
     */
    public getLast (): Row
    {
        const previousPosition = this.cursor.getPosition();

        this.cursor.moveToLast();

        const row = this.getCurrentRow();

        this.cursor.moveToPosition(previousPosition);

        if (this.autoClose)
        {
            this.closed = true;
            this.cursor.close();
        }

        return row;
    }

    /**
     * Reset the iteration cursor to the initial position.
     */
    public reset (): void
    {
        this.cursor.moveToPosition(this.initialCursorPosition);
    }

    /**
     * Close the iterator. \
     * Note that this should only be possible if autoClose has been set to false or the iteration has been incomplete.
     */
    public close (): void
    {
        this.closed = true;
        this.cursor.close();
    }

    /**
     * Get the current row from the cursor.
     * @returns The row.
     */
    private getCurrentRow (): Row
    {
        const row: any = {};

        const columNames = this.cursor.getColumnNames();

        for (let i = columNames.length; i-- > 0;)
        {
            const name = columNames[i];
            const index = this.cursor.getColumnIndex(name);
            const typeId = this.cursor.getType(index);

            let value = null;
            switch (typeId)
            {
                case SqliteCursor.FIELD_TYPE_INTEGER:
                    value = this.cursor.getInt(index);
                    break;
                case SqliteCursor.FIELD_TYPE_FLOAT:
                    value = this.cursor.getDouble(index);
                    break;
                case SqliteCursor.FIELD_TYPE_STRING:
                    value = this.cursor.getString(index);
                    break;
                case SqliteCursor.FIELD_TYPE_BLOB:
                    value = this.cursor.getBlob(index); // TODO: Is this really correct?
                    break;
                case SqliteCursor.FIELD_TYPE_NULL:
                    // Do nothing, value is already null.
                    break;
                default:
                    throw new TypeError('The given SQLite column type is not supported.');
            }

            row[name] = value;
        }

        return row;
    }
}

/**
 * A SQL statement that has been prepared.
 */
class Statement
{
    private sqliteDatabase: SqliteDatabaseType;
    private cachedSqliteStatement: SqliteStatementType|null;
    private autoClose: boolean;

    /**
     * The database this statement is attached to.
     */
    public readonly database: Database;
    /**
     * The original SQL string used to prepare this statement.
     */
    public readonly sql: string;

    /**
     * @param parent The database class that created this statement.
     * @param sqliteDatabase The SQLite database we are working on.
     * @param sql The SQL string.
     * @param autoClose If true, the statement will automatically closed after a result is returned.
     */
    public constructor (parent: Database, sqliteDatabase: SqliteDatabaseType, sql: string, autoClose: boolean)
    {
        this.database = parent;
        this.sqliteDatabase = sqliteDatabase;
        this.sql = sql;
        this.autoClose = autoClose;

        this.cachedSqliteStatement = null;
    }

    /**
     * Run a statement with binding parameters that does not return any values.
     * @param bindParameters An array of parameters to bind. The order is the same as in the SQL string.
     * @returns The number of rows affected.
     */
    public run (bindParameters: any[] = []): number
    {
        const sqliteStatement = this.getBindedStatement(bindParameters);

        const numberOfChanges = sqliteStatement.executeUpdateDelete();

        if (this.autoClose)
        {
            this.close();
        }

        return numberOfChanges;
    }

    /**
     * Get a single number value.
     * @param bindParameters An array of parameters to bind. The order is the same as in the SQL string.
     * @returns The single number value.
     */
    public getSingleNumber (bindParameters: any[] = []): number
    {
        const sqliteStatement = this.getBindedStatement(bindParameters);

        const singleNumber = sqliteStatement.simpleQueryForLong();

        if (this.autoClose)
        {
            this.close();
        }

        return singleNumber;
    }

    /**
     * Get a single string value.
     * @param bindParameters An array of parameters to bind. The order is the same as in the SQL string.
     * @returns The single string value.
     */
    public getSingleString (bindParameters: any[] = []): string
    {
        const sqliteStatement = this.getBindedStatement(bindParameters);

        const singleString = sqliteStatement.simpleQueryForString();

        if (this.autoClose)
        {
            this.close();
        }

        return singleString;
    }

    /**
     * Get the first row.
     * @param bindParameters An array of parameters to bind. The order is the same as in the SQL string.
     * @returns The row.
     */
    public get (bindParameters: any[] = []): Row
    {
        const rowIterator = this.iterate(bindParameters);

        const row = rowIterator.getFirst();

        return row;
    }

    /**
     * Get all rows as array.
     * @param bindParameters An array of parameters to bind. The order is the same as in the SQL string.
     * @returns An array of rows.
     */
    public all (bindParameters: any[] = []): Row[]
    {
        const rowIterator = this.iterate(bindParameters);

        const rows: Row[] = Array.from(rowIterator);

        return rows;
    }

    /**
     * Get an iterator for iterating over the rows.
     * @param bindParameters An array of parameters to bind. The order is the same as in the SQL string.
     * @returns The row iterator.
     */
    public iterate (bindParameters: any[] = []): RowIterator
    {
        const cursor = this.sqliteDatabase.rawQuery(this.sql, bindParameters);

        const rowIterator = new RowIterator(cursor);

        return rowIterator;
    }

    /**
     * Close the statement. \
     * This must be called after use.
     */
    public close (): void
    {
        this.cachedSqliteStatement?.close();

        this.cachedSqliteStatement = null;
    }

    /**
     * Bind parameters to the statement. It will be compiled if needed.
     * @param bindParameters An array of parameters to bind. The order is the same as in the SQL string given to the statement.
     * @returns The statement with binded parameters.
     */
    private getBindedStatement (bindParameters: any[]): SqliteStatementType
    {
        if (this.cachedSqliteStatement === null)
        {
            this.cachedSqliteStatement = this.sqliteDatabase.compileStatement(this.sql);
        }

        this.cachedSqliteStatement.clearBindings();

        let counter = 1;

        for (const value of bindParameters)
        {
            if ((value === null) || (value === undefined))
            {
                this.cachedSqliteStatement.bindNull(counter);
            }
            else
            {
                switch (typeof value)
                {
                    case 'number':
                        if (Number.isInteger(value))
                        {
                            this.cachedSqliteStatement.bindLong(counter, value);
                        }
                        else
                        {
                            this.cachedSqliteStatement.bindDouble(counter, value);
                        }
                        break;
                    case 'boolean':
                    {
                        const valueAsNumber = value ? 1 : 0;
                        this.cachedSqliteStatement.bindLong(counter, valueAsNumber);
                        break;
                    }
                    case 'string':
                        this.cachedSqliteStatement.bindString(counter, value);
                        break;
                    default:
                        // TODO: Is this correct?
                        this.cachedSqliteStatement.bindBlob(counter, value);
                }
            }

            counter++;
        }

        return this.cachedSqliteStatement;
    }
}

/**
 * Options for creating a database.
 */
export interface Options
{
    /**
     * Whether the database shall only exist in memory and not on disk.
     */
    inMemory?: boolean;
    /**
     * Whether the database shall be opened in readonly mode.
     */
    readonly?: boolean;
    /**
     * If true the database will be created if it does not exist already, otherwise an exception is thrown.
     */
    createIfNotExist?: boolean;
}

/**
 * The SQL database class containing everything needed.
 */
export class Database
{
    private sqliteDatabase: SqliteDatabaseType;

    private _isOpen: boolean;

    /**
     * The name used to create the database.
     */
    public readonly name: string;
    /**
     * Whether the database is in memory.
     */
    public readonly isInMemory: boolean;
    /**
     * Whether the database is readonly.
     */
    public readonly isReadonly: boolean;

    /**
     * Wether the database is currently opened or closed.
     */
    public get isOpen (): boolean
    {
        return this._isOpen;
    }

    /**
     * The version of the database. \
     * This can be set and get by the user to determine whether an upgrade of the database schema is necessary.
     */
    public get version (): number
    {
        return this.sqliteDatabase.getVersion();
    }

    public set version (version: number)
    {
        this.sqliteDatabase.setVersion(version);
    }

    constructor (name: string, options: Options = {})
    {
        options.inMemory = options.inMemory ?? false;
        options.readonly = options.readonly ?? false;
        options.createIfNotExist = options.createIfNotExist ?? true;

        this.name = name;
        this.isInMemory = options.inMemory;
        this.isReadonly = options.readonly;

        if (options.inMemory)
        {
            this.sqliteDatabase = SqliteDatabase.create(null as any);
        }
        else
        {
            let openMode = options.readonly ? SqliteDatabase.OPEN_READONLY : SqliteDatabase.OPEN_READWRITE;
            if (options.createIfNotExist)
            {
                openMode = openMode || SqliteDatabase.CREATE_IF_NECESSARY;
            }

            const file = this.getAppContext().getDatabasePath(name);

            if(!file.exists())
            {
                // Make sure we can write to the file:
                file.getParentFile().mkdirs();
                file.getParentFile().setReadable(true);
                file.getParentFile().setWritable(true);
            }

            this.sqliteDatabase = SqliteDatabase.openDatabase(file.getAbsolutePath(), null as any, openMode);
        }

        this._isOpen = true;
    }

    /**
     * Directly execute the given SQL string. The SQL must only contain a single statement and not return anything.
     * @param sql The SQL string to execute.
     */
    public execute (sql: string): void
    {
        this.sqliteDatabase.execSQL(sql);
    }

    /**
     * Set a pragma statement and return the result.
     * @param sql The pragma SQL string.
     * @returns The pragma result. Empty if there is none.
     */
    public pragma (sql: string): Row[]
    {
        const pragmaSql = 'PRAGMA ' + sql;

        const statement = this.prepare(pragmaSql, true);

        const result = statement.all();

        return result;
    }

    /**
     * Create a new prepared statement from the given SQL string.
     * @param sql The SQL string to prepare.
     * @param autoClose If true, the statement will automatically closed after a result is returned.
     * @returns The prepared statement.
     */
    public prepare (sql: string, autoClose = false): Statement
    {
        const statement = new Statement(this, this.sqliteDatabase, sql, autoClose);

        return statement;
    }

    /**
     * The last row ID that has been inserted into a table.
     */
    public lastInsertRowId (): number
    {
        const sql = 'SELECT last_insert_rowid();';

        const statement = this.prepare(sql, true);

        const lastInsertedRowId = statement.getSingleNumber();

        return lastInsertedRowId;
    }

    /**
     * Close the database connection.
     */
    public close (): void
    {
        // TODO: What happens if you try to do something after closing?

        this._isOpen = false;

        this.sqliteDatabase.close();
    }

    /**
     * Get the context of the app.
     * Can fail if this is not possible. TODO: Describe how.
     */
    private getAppContext (): android.content.Context
    {
        const context: android.content.Context = app.android.context ?? app.getNativeApplication();

        return context;
    }
}
