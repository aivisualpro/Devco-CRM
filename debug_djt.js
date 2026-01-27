const { MongoClient } = require('mongodb');

async function debugData() {
    const uri = "mongodb+srv://adeel_db_user:Z8jNQ2cnWAdAmUFI@cluster0.kvjvx8x.mongodb.net/devco";
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db('devco');
        
        const djt = await db.collection('dailyjobtickets').findOne({ 
            equipmentUsed: { $exists: true, $not: { $size: 0 } } 
        });
        if (djt) {
            console.log('Sample DJT with equipment:');
            console.log(JSON.stringify(djt, null, 2));
        } else {
            // Check standalone collection structure
            const any = await db.collection('dailyjobtickets').findOne({});
            console.log('Sample DJT:', JSON.stringify(any, null, 2));
        }

    } finally {
        await client.close();
    }
}

debugData();
