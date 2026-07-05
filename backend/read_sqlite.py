import sqlite3
conn = sqlite3.connect('backend/goldguard.db')
cursor = conn.cursor()
cursor.execute(" SELECT name FROM sqlite_master WHERE type=table\)
tables = cursor.fetchall()
print('Tables in goldguard.db:')
for table in tables:
 tname = table[0]
 cursor.execute(f'SELECT COUNT(*) FROM {tname}')
 count = cursor.fetchone()[0]
 print(f' - {tname}: {count} rows')
conn.close()
