#!/usr/bin/env python3
"""Create or reset the admin login used by POST /api/auth/admin.

The password is prompted for (never passed on the command line) unless
--password is given, and is stored only as a werkzeug scrypt hash.
"""
import argparse
import getpass
import os
import sys

from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row
from werkzeug.security import generate_password_hash

DEV_DATABASE_URL = "postgresql:///ltride_dev"


def resolve_database_url():
    load_dotenv()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        database_url = DEV_DATABASE_URL
        print(f"DATABASE_URL not set; using dev default {DEV_DATABASE_URL}")
    return database_url


def prompt_password():
    first = getpass.getpass("New admin password: ")
    second = getpass.getpass("Confirm password: ")
    if first != second:
        sys.exit("Passwords did not match.")
    return first


def main():
    parser = argparse.ArgumentParser(description="Create or reset an admin login.")
    parser.add_argument("--username", required=True, help="Admin login name.")
    parser.add_argument("--name", help="Display name (defaults to the username).")
    parser.add_argument("--email", help="Contact email (optional).")
    parser.add_argument("--password", help="Skip the prompt (avoid on shared shells).")
    parser.add_argument("--force", action="store_true",
                        help="Reset the password if the admin already exists.")
    args = parser.parse_args()

    password = args.password or prompt_password()
    if not password:
        sys.exit("Password cannot be empty.")
    password_hash = generate_password_hash(password)

    with psycopg.connect(resolve_database_url(), row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT id, name, email FROM users WHERE username = %s", (args.username,))
            existing = cursor.fetchone()
            if existing and not args.force:
                sys.exit(f"Admin '{args.username}' already exists. "
                         "Re-run with --force to reset the password.")
            if existing:
                # Keep the current name/email unless this run supplies new ones,
                # so a --force password reset never wipes them.
                display_name = args.name or existing["name"]
                email = args.email if args.email is not None else existing["email"]
                cursor.execute(
                    "UPDATE users SET password_hash=%s, name=%s, email=%s, role='admin' "
                    "WHERE id=%s", (password_hash, display_name, email, existing["id"]))
                action = "updated"
            else:
                cursor.execute(
                    "INSERT INTO users (role, username, password_hash, name, email) "
                    "VALUES ('admin', %s, %s, %s, %s)",
                    (args.username, password_hash, args.name or args.username, args.email))
                action = "created"
        connection.commit()
    print(f"Admin '{args.username}' {action}.")


if __name__ == "__main__":
    main()
