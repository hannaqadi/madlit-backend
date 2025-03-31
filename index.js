const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: ['https://madlit-web.vercel.app', 'http://localhost:3000'],
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: 'Content-Type,Authorization',
  credentials:true,
};
//for local or open to all origins
// app.use(cors());
app.use(cors(corsOptions));
app.use(express.json());

console.log("DATABASE_URL:", process.env.DATABASE_URL);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Render + Supabase
});

// const pool below is for running locally
// const pool = new Pool({
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   password: process.env.DB_PASSWORD,
//   port: process.env.DB_PORT,
// });

app.get('/', (req, res) => {
  res.send('Backend is running!');
});


app.get('/test-db', async (req, res) => {
  try {
    // Example query to test the database connection
    const result = await pool.query('SELECT NOW()'); // This will get the current time from the database
    res.json({
      message: 'Database connected!',
      time: result.rows[0].now, // The database time, or you can replace this with a more complex query result
    });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.get('/api/stories', async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = parseInt(req.query.limit) || 3; // Default to 3 items per page
  const search = req.query.search || ''; // Default to no search
  const genres = req.query.genres || ''; // Default to no genres
  const offset = (page - 1) * limit;

  try {
    // Parse genres into an array of integers
    const genreIds = genres.split(',').map((id) => parseInt(id)).filter((id) => !isNaN(id));

    // Base query with optional genre filtering
    let query = `
      SELECT *, 
      CASE
        WHEN title::text ILIKE $3 THEN 3
        WHEN title::text ILIKE $4 THEN 2
        ELSE 1
      END AS relevance
      FROM stories
      WHERE title::text ILIKE $2
    `;

    const params = [limit, `%${search}%`, `${search}%`, `%${search}%`, offset];
    let genreFilterIndex = params.length + 1;

    // Add genre filtering if genreIds are provided
    if (genreIds.length > 0) {
      query += ` AND genre_id = ANY($${genreFilterIndex})`;
      params.push(genreIds);
    }

    query += `
      ORDER BY relevance DESC, id ASC
      LIMIT $1 OFFSET $5
    `;

    const result = await pool.query(query, params);

    // Count total stories for pagination, including genre filtering
    let countQuery = 'SELECT COUNT(*) FROM stories WHERE title::text ILIKE $1';
    const countParams = [`%${search}%`];

    if (genreIds.length > 0) {
      countQuery += ' AND genre_id = ANY($2)';
      countParams.push(genreIds);
    }

    const total = await pool.query(countQuery, countParams);

    res.json({
      stories: result.rows,
      currentPage: page,
      totalPages: Math.ceil(total.rows[0].count / limit),
    });
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/genres', async (req, res) => {

  try{
    const result = await pool.query('SELECT * FROM genres');
    res.json({
      genres: result.rows
    });
  } catch (error){
    console.error('Error fetching genres:', error)
    res.status(500).json({ error: 'Failed to fetch genres' });
  }

});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});