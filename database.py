import sqlite3

conn = sqlite3.connect(
    "asl.db",
    check_same_thread=False
)

cursor = conn.cursor()

# Check if users table has firebase_uid column
cursor.execute("PRAGMA table_info(users)")
user_cols = [col[1] for col in cursor.fetchall()]

if not user_cols:
    cursor.execute("""
    CREATE TABLE users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        firebase_uid TEXT UNIQUE,
        username TEXT UNIQUE,
        email TEXT,
        password TEXT,
        profile_photo TEXT
    )
    """)
elif "firebase_uid" not in user_cols:
    cursor.execute("ALTER TABLE users ADD COLUMN firebase_uid TEXT")

# Detections table
cursor.execute("PRAGMA table_info(detections)")
detect_cols = [col[1] for col in cursor.fetchall()]

if not detect_cols:
    cursor.execute("""
    CREATE TABLE detections(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        alphabet TEXT,
        confidence REAL,
        model_name TEXT,
        model_type TEXT,
        timestamp TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)
elif "user_id" not in detect_cols:
    cursor.execute("ALTER TABLE detections RENAME TO detections_old")
    cursor.execute("""
    CREATE TABLE detections(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        alphabet TEXT,
        confidence REAL,
        model_name TEXT,
        model_type TEXT,
        timestamp TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    """)
    cursor.execute("""
    INSERT INTO detections (id, alphabet, confidence, model_name, model_type, timestamp)
    SELECT id, alphabet, confidence, model_name, model_type, timestamp FROM detections_old
    """)
    cursor.execute("DROP TABLE detections_old")

conn.commit()
