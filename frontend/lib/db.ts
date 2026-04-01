import mysql, { ResultSetHeader, RowDataPacket } from 'mysql2/promise'

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true
})

export async function query<T extends RowDataPacket = RowDataPacket>(sql: string, params?: any[]): Promise<T[]> {
    const [rows] = await pool.execute<T[]>(sql, params)
    return rows
}

export async function execute(sql: string, params?: any[]): Promise<ResultSetHeader> {
    const [result] = await pool.execute<ResultSetHeader>(sql, params)
    return result
}

export async function getConnection() {
    return pool.getConnection()
}

export { pool }
