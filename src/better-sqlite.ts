// eslint-disable-next-line @typescript-eslint/triple-slash-reference, spaced-comment
/// <reference path="../node_modules/tns-platform-declarations/android-24.d.ts" />

import * as app from "tns-core-modules/application";

// Alias the long name:
const AndroidSqlite = android.database.sqlite.SQLiteDatabase;
type AndroidSqliteDatabase = android.database.sqlite.SQLiteDatabase;
type AndroidSqliteStatement = android.database.sqlite.SQLiteStatement;

class Statement
{
    private sqliteDatabase: AndroidSqliteDatabase;
    private sqliteStatement: AndroidSqliteStatement;

    public readonly database: Database;
    public readonly sql: string;

    public constructor (parent: Database, sqliteDatabase: AndroidSqliteDatabase, sql: string)
    {
        this.database = parent;
        this.sqliteDatabase = sqliteDatabase;
        this.sql = sql;

        this.sqliteStatement = sqliteDatabase.compileStatement(sql);
    }

    /**
     * Run a statement with binding parameters that does not return any values.
     * @param bindParameters The parameters to bind.
     * @returns The number of rows affected.
     */
    public run (bindParameters: any = []): number
    {
        this.bind(bindParameters);

        const numberOfChanges = this.sqliteStatement.executeUpdateDelete();

        return numberOfChanges;
    }

    public get (bindParameters?: any): any // The Row
    {
        return bindParameters;
    }

    public all (bindParameters?: any): any // An array of rows
    {
        return bindParameters;
    }

    public iterate (bindParameters?: any): any // An iterator for the rows
    {
        return bindParameters;
    }

    private bind (bindParameters: any): void
    {
        this.sqliteStatement.clearBindings();

        let counter = 1;

        for (const value of bindParameters)
        {
            if ((value === null) || (value === undefined))
            {
                this.sqliteStatement.bindNull(counter);
            }
            else if (typeof value === 'number')
            {
                if (Number.isInteger(value))
                {
                    this.sqliteStatement.bindLong(counter, value);
                }
                else
                {
                    this.sqliteStatement.bindDouble(counter, value);
                }
            }
            else if (typeof value === 'boolean')
            {
                const valueAsNumber = value ? 1 : 0;

                this.sqliteStatement.bindLong(counter, valueAsNumber);
            }
            else if (typeof value === 'string')
            {
                this.sqliteStatement.bindString(counter, value);
            }
            else
            {
                // TODO: Is this correct?
                this.sqliteStatement.bindBlob(counter, value);
            }

            counter++;
        }
    }
}

export interface Options
{
    inMemory?: boolean;
    readonly?: boolean;
    createIfNotExist?: boolean;
}

export class Database
{
    private sqliteDatabase: AndroidSqliteDatabase;

    private _isOpen: boolean;

    public readonly name: string;
    public readonly isInMemory: boolean;
    public readonly isReadonly: boolean;

    public get isOpen (): boolean
    {
        return this._isOpen;
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
            this.sqliteDatabase = AndroidSqlite.create(null as any);
        }
        else
        {
            let openMode = options.readonly ? AndroidSqlite.OPEN_READONLY : AndroidSqlite.OPEN_READWRITE;
            if (options.createIfNotExist)
            {
                openMode = openMode || AndroidSqlite.CREATE_IF_NECESSARY;
            }

            const file = this.getAppContext().getDatabasePath(name);

            // Make sure we can write to the file:
            if(!file.exists())
            {
                file.getParentFile().mkdirs();
                file.getParentFile().setReadable(true);
                file.getParentFile().setWritable(true);
            }

            this.sqliteDatabase = AndroidSqlite.openDatabase(file.getAbsolutePath(), null as any, openMode);
        }

        this._isOpen = true;
    }

    /**
     * Directly execute the given SQL string. The SQL must not return anything.
     * @param sql The SQL string to execute.
     */
    public execute (sql: string): void
    {
        this.sqliteDatabase.execSQL(sql);
    }

    /**
     * Create a new prepared statement from the given SQL string.
     * @param sql The SQL string to prepare.
     * @returns The prepared statement.
     */
    public prepare (sql: string): Statement
    {
        const statement = new Statement(this, this.sqliteDatabase, sql);

        return statement;
    }

    /**
     * The last row ID that has been inserted into a table.
     */
    public lastRowId (): number
    {
        const sql = 'SELECT last_insert_rowid();';

        const cursor = this.sqliteDatabase.rawQuery(sql, []);

        cursor.moveToFirst();

        const lastInsertedRowId = cursor.getInt(0);

        cursor.close();

        return lastInsertedRowId;
    }

    /**
     * Close the database connection.
     * TODO: What happens if you try to do something after closing?
     */
    public close (): void
    {
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
