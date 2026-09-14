CREATE TABLE developer (
    fullname TEXT CHECK(length(fullname) <= 40),
    email TEXT CHECK(length(email) <= 40),
    picture TEXT CHECK(length(picture) <= 64),
    password TEXT CHECK(length(password) <= 256),
    created DATETIME DEFAULT CURRENT_TIMESTAMP
);