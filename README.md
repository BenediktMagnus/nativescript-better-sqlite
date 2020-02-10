# Nativescript-Better-Sqlite

A Nativescript plugin providing easy SQLite access on Android.


## Installation:

```
tns plugin add nativescript-better-sqlite
```


## What is working:
- Create/connect database
- In memory databases
- Readonly databases
- Prepared statements
- Get single values
- Iterator for rows
- Get last inserted row
- Pragmas


## Example

The following code

```typescript
import * as Sqlite from "nativescript-better-sqlite";

const database = new Sqlite.Database('users', { inMemory: true });

database.pragma('journal_mode = WAL');

database.execute(
    `CREATE TABLE
        user (id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
              name TEXT NOT NULL);`
);

const insert = database.prepare('INSERT INTO user (name) VALUES (?)');

insert.run(['testName1']);
insert.run(['testName2']);

insert.close();

const names = database.prepare('SELECT * FROM user', true).all();

console.log(names);
```

results in

```json
[
    {
        "name" : "testName1",
        "id" : 1
    },
    {
        "name" : "testName2",
        "id" : 2
    }
]
```

this output.


## TODOs:
- Transactions
- Workers / async
- Results as array
- Optimisations
