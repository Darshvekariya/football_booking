

// This is your Vercel Serverless Function
// It will handle all requests to /api/
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const path = require('path'); // <-- ADD THIS LINE

// Create an Express app
const app = express();

// --- IMPORTANT ---
// Add your MongoDB connection string here
// You should store this in Vercel Environment Variables
const MONGODB_URI = process.env.MONGODB_URI ;

let db;

// Middleware
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON bodies

// --- ADD THIS: Serve static files (index.html) ---
// This tells Express to serve files from the parent directory (where index.html is)
const staticPath = path.join(__dirname, '..');
app.use(express.static(staticPath));

// Function to connect to MongoDB
async function connectToDb() {
    if (db) return db; // Return existing connection
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        console.log("Connected to MongoDB!");
        db = client.db("dynamicTurf"); // Use a database named "dynamicTurf"
        return db;
    } catch (error) {
        console.error("Failed to connect to MongoDB", error);
        throw error;
    }
}

// --- API Routes ---

// Test route
app.get('/api/test', (req, res) => {
    res.status(200).json({ message: "API is working!" });
});

// --- Bookings ---
// GET all bookings
app.get('/api/bookings', async (req, res) => {
    try {
        const db = await connectToDb();
        // Find all bookings, sort by date descending
        const bookings = await db.collection('bookings').find({}).sort({ date: -1 }).toArray();
        res.status(200).json(bookings);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// POST a new booking
app.post('/api/bookings', async (req, res) => {
    try {
        const db = await connectToDb();
        const bookingData = req.body;

        // Add server-side timestamp
        bookingData.createdAt = new Date();

        // Insert new booking
        const result = await db.collection('bookings').insertOne(bookingData);
        
        // Return the inserted document
        const newBooking = await db.collection('bookings').findOne({ _id: result.insertedId });
        res.status(201).json(newBooking);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

// GET all booked slots (for rendering the grid)
app.get('/api/booked-slots', async (req, res) => {
    try {
        const db = await connectToDb();
        const bookings = await db.collection('bookings').find({}, { projection: { groundId: 1, date: 1, slot: 1 } }).toArray();
        
        // Process into a simple map for the frontend
        const bookedSlotsMap = {};
        
        for (const booking of bookings) {
            const { groundId, date, slot } = booking;
            const dateString = new Date(date).toISOString().split('T')[0]; // Format as YYYY-MM-DD
            
            if (!bookedSlotsMap[groundId]) {
                bookedSlotsMap[groundId] = {};
            }
            if (!bookedSlotsMap[groundId][dateString]) {
                bookedSlotsMap[groundId][dateString] = [];
            }
            bookedSlotsMap[groundId][dateString].push(slot);
        }
        
        res.status(200).json(bookedSlotsMap);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch booked slots' });
    }
});


// --- Reviews ---
// GET all reviews
app.get('/api/reviews', async (req, res) => {
    try {
        const db = await connectToDb();
        // Find all reviews, sort by timestamp descending
        const reviews = await db.collection('reviews').find({}).sort({ timestamp: -1 }).toArray();
        res.status(200).json(reviews);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// POST a new review
app.post('/api/reviews', async (req, res) => {
    try {
        const db = await connectToDb();
        const reviewData = req.body;
        
        // Insert new review
        const result = await db.collection('reviews').insertOne(reviewData);

        // Return the inserted document
        const newReview = await db.collection('reviews').findOne({ _id: result.insertedId });
        res.status(201).json(newReview);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create review' });
    }
});

// --- Purchases (for both accessories and refreshments) ---
// POST a new purchase
app.post('/api/purchases', async (req, res) => {
    try {
        const db = await connectToDb();
        const purchaseData = req.body;

        // Add server-side timestamp
        purchaseData.createdAt = new Date();
        
        // Insert new purchase
        const result = await db.collection('purchases').insertOne(purchaseData);
        
        // Return the inserted document
        const newPurchase = await db.collection('purchases').findOne({ _id: result.insertedId });
        res.status(201).json(newPurchase);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create purchase' });
    }
});

// --- ADD THIS: Handle root route ---
// This ensures that visiting http://localhost:3000/ serves your index.html
// This MUST be after your API routes
app.get('/', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
});

// --- ADD THIS: Start the server ---
// (This will be ignored by Vercel, but works for 'npm start')
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // We don't need to connectToDb here, as it's called on-demand by routes
});

// Export the app for Vercel
module.exports = app;
