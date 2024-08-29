const express = require('express');
const axios = require('axios');
const path = require('path');
const User=require('./models/login')
const app = express();
const port = 3000;
const mongoose=require('mongoose');

app.use(express.urlencoded({extended:true}));
const apiKey = 'AIzaSyB3X_zPual5zlhz9BTgXZNgYmBanJdPb4Y';
const Price=require('./models/prices');
function getDummyPrice(type) {
    switch (type) {
        case 'restaurant':
            return '$$'; // Example: Medium range price
        case 'museum':
            return '$'; // Example: Low range price
        case 'cafe':
            return '$'; // Example: Low range price
        case 'taxi_stand':
            return '$'; // Example: Low range price
        case 'historical_place':
            return '$$'; // Example: Medium range price
        case 'hotel':
            return '$$$'; // Example: High range price
        default:
            return '$'; // Default dummy price
    }
}

async function getPlaceData(placeName, category) {
    try {
        const placeSearchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(placeName)}&inputtype=textquery&fields=place_id,photos,geometry&key=${apiKey}`;
        const response = await axios.get(placeSearchUrl);
        const place = response.data.candidates[0];
        const placeId = place.place_id;
        const photoReference = place.photos?.[0]?.photo_reference;
        const location = place.geometry?.location;

        const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,international_phone_number,website,opening_hours,rating,user_ratings_total,reviews&key=${apiKey}`;
        const detailsResponse = await axios.get(placeDetailsUrl);
        const placeDetails = detailsResponse.data.result;

        const photoUrl = photoReference
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${apiKey}`
            : null;

        // Define the types you want to search for
        const types = category === 'all' ? ['cafe', 'museum', 'restaurant', 'historical_place', 'taxi_stand'] : [category];
        
        const nearbyPlacesPromises = types.map(async (type) => {
            const nearbyPlacesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location?.lat},${location?.lng}&radius=1500&type=${type}&key=${apiKey}`;
            const nearbyResponse = await axios.get(nearbyPlacesUrl);
            return {
                type: type,
                places: nearbyResponse.data.results.map(place => ({
                    name: place.name,
                    vicinity: place.vicinity,
                    photoUrl: place.photos ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photos[0].photo_reference}&key=${apiKey}` : null,
                    type: type, // Update based on actual type
                    price: getDummyPrice(type) // Dummy price
                }))
            };
        });

        const nearbyPlaces = await Promise.all(nearbyPlacesPromises);

        return { photoUrl, placeDetails, location, nearbyPlaces };
    } catch (error) {
        console.error('Error fetching place data:', error);
        return { photoUrl: null, placeDetails: null, nearbyPlaces: [] };
    }
}

app.get('/get-place-data', async (req, res) => {
    const placeName = req.query.placeName || 'Eiffel Tower';
    const category = req.query.category || 'all'; // Default to 'all' if no category is specified
    const placeData = await getPlaceData(placeName, category);
    res.json(placeData);
});

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'public','index.html'));
});
const dbUrl = 'mongodb+srv://vijaykumarveerla3377:user123@cluster0.q6sk2.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connection established'))
    .catch(err => console.error('Connection error', err));

// POST route for user sign up
app.post('/sign', async (req, res) => {
    const { email, pass } = req.body;
    try {
        const user = new User({
            email: email,
            password: pass
        });
        await user.save();
        console.log('User saved successfully');
        res.redirect('/login'); // Redirect to login page after successful sign-up
    } catch (err) {
        console.log(err);
        res.status(500).send('Error saving user');
    }
});


app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

// Serve the login page
// Serve the login page and handle login check});
app.post('/login', async (req, res) => {
   const email=req.body.email;
   const pass=req.body.pass;
    try {
        const user = await User.findOne({ email: email }); // Check if the email exists
        if (user) {
            // Compare the entered password with the stored password
            if (user.password === pass) {
                res.redirect('/');
            } else {
                res.send('Incorrect password');
            }
        } else {
            res.send('No user found with this email');
        }
    } catch (err) {
        console.error(err);
        res.status(500).send('Error during login');
    }
});
app.get('/login',(req,res)=>
{
    res.sendFile(path.join(__dirname,'public','login.html'));
});

app.post('/payment', async (req, res) => {
    const destination=req.body.destination;
    const count=parseInt(req.body.count);
   

    if (!destination || !count) {
        return res.status(400).send('Missing required fields');
    }

    try {
        // Use a regular expression for partial match
        const regex = new RegExp(destination, 'i'); // 'i' flag for case-insensitive

        // Find the price for the given destination using regex
        const priceEntry = await Price.findOne({ Destination: { $regex: regex } });

        if (!priceEntry) {
            return res.status(404).send('Destination not found');
        }

        // Extract the cost range from the `Estimated_cost` field
        const costRange = priceEntry.Estimated_cost;
        const costRangeMatch = costRange.match(/\$([\d,]+) to \$([\d,]+)/);

        if (!costRangeMatch) {
            return res.status(500).send('Invalid cost format in database');
        }

        // Extract minimum and maximum values
        const minCost = parseFloat(costRangeMatch[1].replace(/,/g, ''));
        const maxCost = parseFloat(costRangeMatch[2].replace(/,/g, ''));

        if (isNaN(minCost) || isNaN(maxCost)) {
            return res.status(500).send('Invalid cost data in database');
        }

        // Generate a random cost between minCost and maxCost
        const randomCost = Math.random() * (maxCost - minCost) + minCost;

        console.log('Min Cost:', minCost);
        console.log('Max Cost:', maxCost);
        console.log('Random Cost:', randomCost);
        console.log('Count:', count);

        // Calculate the total cost
        const totalCost = randomCost * count;
        console.log('Total Cost:', totalCost);

        // Send the total cost in the response
        res.redirect(`/result.html?totalCost=${totalCost.toFixed(2)}`); // Round to 2 decimal places
    } catch (error) {
        console.error('Error finding price:', error);
        res.status(500).send('Server error');
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
