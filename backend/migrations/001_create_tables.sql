CREATE TABLE IF NOT EXISTS useraccount (
    cid INTEGER PRIMARY KEY,
    name TEXT,
    division TEXT,
    subdivision TEXT,
    lastlogin TIMESTAMP
);

CREATE TABLE IF NOT EXISTS userdata (
    cid INTEGER NOT NULL,
    key TEXT NOT NULL,
    data JSONB,
    PRIMARY KEY (cid, key)
);
