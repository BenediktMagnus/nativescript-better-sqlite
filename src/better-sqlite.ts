// eslint-disable-next-line @typescript-eslint/triple-slash-reference, spaced-comment
/// <reference path="../node_modules/tns-platform-declarations/android-24.d.ts" />

import * as app from "tns-core-modules/application";

// Alias the long name:
const AndroidSqlite = android.database.sqlite.SQLiteDatabase;
type AndroidSqliteDatabase = android.database.sqlite.SQLiteDatabase;

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
