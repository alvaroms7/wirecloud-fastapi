from datetime import datetime, timezone
import sqlite3

from bson import ObjectId

from wirecloud.commons import commands


def _legacy_database() -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:")
    connection.row_factory = sqlite3.Row
    connection.executescript(
        """
        CREATE TABLE auth_group (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE auth_user (
            id INTEGER PRIMARY KEY,
            password TEXT,
            last_login,
            is_superuser,
            username TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            is_staff,
            is_active,
            date_joined
        );
        CREATE TABLE auth_user_groups (id INTEGER PRIMARY KEY, user_id INTEGER, group_id INTEGER);
        CREATE TABLE django_content_type (
            id INTEGER PRIMARY KEY, app_label TEXT NOT NULL, model TEXT NOT NULL
        );
        CREATE TABLE auth_permission (
            id INTEGER PRIMARY KEY, name TEXT, content_type_id INTEGER, codename TEXT NOT NULL
        );
        CREATE TABLE auth_user_user_permissions (
            id INTEGER PRIMARY KEY, user_id INTEGER, permission_id INTEGER
        );
        CREATE TABLE auth_group_permissions (
            id INTEGER PRIMARY KEY, group_id INTEGER, permission_id INTEGER
        );
        CREATE TABLE wirecloud_organization (
            id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, group_id INTEGER NOT NULL
        );
        CREATE TABLE wirecloud_team (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, organization_id INTEGER NOT NULL
        );
        CREATE TABLE wirecloud_team_users (
            id INTEGER PRIMARY KEY, team_id INTEGER NOT NULL, user_id INTEGER NOT NULL
        );
        CREATE TABLE wirecloud_platformpreference (
            id INTEGER PRIMARY KEY, name TEXT NOT NULL, value TEXT, user_id INTEGER NOT NULL
        );

        INSERT INTO auth_group VALUES (1, 'Acme'), (2, 'Editors');
        INSERT INTO auth_user VALUES
            (1, 'hash-a', '2024-03-01 12:30:00', 0, 'alice', 'Alice', 'Owner',
             'alice@example.com', 0, 1, 1700000000000),
            (2, 'hash-b', NULL, 0, 'bob', 'Bob', 'Member',
             'bob@example.com', 0, 1, '2024-01-02T03:04:05Z'),
            (3, '!', NULL, 0, 'acme', '', '', '', 0, 1, '2024-01-01 00:00:00');
        INSERT INTO auth_user_groups VALUES (1, 1, 2), (2, 2, 1);
        INSERT INTO wirecloud_organization VALUES (10, 3, 1);
        INSERT INTO wirecloud_team VALUES (20, 'owners', 10), (21, 'developers', 10);
        INSERT INTO wirecloud_team_users VALUES (1, 20, 1), (2, 21, 2);
        INSERT INTO wirecloud_platformpreference VALUES (1, 'theme', 'dark', 1);

        INSERT INTO django_content_type VALUES
            (1, 'auth', 'user'),
            (2, 'platform', 'workspace'),
            (3, 'custom', 'thing');
        INSERT INTO auth_permission VALUES
            (1, 'Can add user', 1, 'add_user'),
            (2, 'Can change workspace', 2, 'change_workspace'),
            (3, 'Can frobnicate thing', 3, 'frobnicate_thing');
        INSERT INTO auth_user_user_permissions VALUES (1, 1, 1), (2, 1, 3);
        INSERT INTO auth_group_permissions VALUES (1, 2, 2);
        """
    )
    return connection


async def test_migrate_users_groups_organizations_teams_and_permissions(db_session):
    await db_session.client.users.delete_many({})
    await db_session.client.groups.delete_many({})
    legacy = _legacy_database()

    try:
        user_mapping, group_mapping = await commands._migrate_users_and_groups(
            legacy, db_session, "sqlite"
        )

        assert set(user_mapping) == {1, 2}
        assert set(group_mapping) == {1, 2}
        assert await db_session.client.users.find_one({"username": "acme"}) is None

        root = await db_session.client.groups.find_one({"name": "Acme"})
        owners = await db_session.client.groups.find_one({"name": "Acme/owners"})
        developers = await db_session.client.groups.find_one({"name": "Acme/developers"})
        members = await db_session.client.groups.find_one({"name": "Acme/members"})
        editors = await db_session.client.groups.find_one({"name": "Editors"})

        assert root["is_organization"] is True
        assert root["path"] == [root["_id"]]
        assert owners["path"] == [root["_id"], owners["_id"]]
        assert developers["path"] == [root["_id"], developers["_id"]]
        assert members["path"] == [root["_id"], members["_id"]]
        assert {permission["codename"] for permission in editors["group_permissions"]} == {
            "WORKSPACE.*"
        }

        alice_id = ObjectId(user_mapping[1])
        bob_id = ObjectId(user_mapping[2])
        assert root["users"] == [alice_id]
        assert owners["users"] == [alice_id]
        assert developers["users"] == [bob_id]
        assert members["users"] == [bob_id]

        alice = await db_session.client.users.find_one({"_id": alice_id})
        bob = await db_session.client.users.find_one({"_id": bob_id})
        assert {permission["codename"] for permission in alice["user_permissions"]} >= {
            "USER.CREATE",
            "custom.frobnicate_thing",
        }
        assert editors["_id"] in alice["groups"]
        assert owners["_id"] in alice["groups"]
        assert developers["_id"] in bob["groups"]
        assert members["_id"] in bob["groups"]
        assert alice["preferences"] == [{"name": "theme", "value": "dark"}]
        assert isinstance(alice["date_joined"], datetime)
        # BSON normalizes datetimes to naive UTC on retrieval.
        assert alice["date_joined"].replace(tzinfo=timezone.utc).timestamp() == 1700000000
        assert bob["date_joined"].year == 2024

        # Re-running the migration reuses deterministic user/group identities.
        second_user_mapping, second_group_mapping = await commands._migrate_users_and_groups(
            legacy, db_session, "sqlite"
        )
        assert second_user_mapping == user_mapping
        assert second_group_mapping == group_mapping
        assert await db_session.client.users.count_documents({"username": "alice"}) == 1
        assert await db_session.client.groups.count_documents({"name": "Acme/owners"}) == 1
    finally:
        legacy.close()


def test_migration_value_normalizers():
    assert commands._as_bool(True) is True
    assert commands._as_bool("yes") is True
    assert commands._as_bool("0") is False
    assert commands._as_datetime(None) is None
    assert commands._as_datetime(1700000000000).tzinfo == timezone.utc
    assert commands._as_datetime("2024-01-02T03:04:05Z").tzinfo == timezone.utc
