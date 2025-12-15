const express = require('express')
const cors = require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SCRETE);

const app = express()
const port = process.env.PORT || 3000

// middleware
app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
  res.send('Hello World!')
})
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jckqi5e.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db('contesthub_db')
    const contestColl = db.collection('contestCollection')
    //  constest api
    app.get('/contest', async (req, res) => {
      const query = {}
      const { email, status } = req.query
      if (email) {
        query.email = email; 
      }
      if (status) {
        query.status = status;
      }
      const cursor = contestColl.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })

    // app.get('/contest', async (req, res) => {
    //   const { status } = req.query;

    //   const query = {};
    //   if (status) {
    //     query.status = status;  
    //   }

    //   const result = await contestColl.find(query).toArray();
    //   res.send(result);
    // });


    app.post("/contest", async (req, res) => {
      const contest = req.body
      contest.status = 'pending'
      contest.createdAt = new Date()
      const result = await contestColl.insertOne(contest)
      res.send(result)
    })
    app.get('/contest/:id', async (req, res) => {
      const id = req.params.id;
      const result = await contestColl.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });
    // Update contest by id
    app.patch("/contest/:id", async (req, res) => {
      const { id } = req.params;      // URL থেকে id নাও
      const updatedData = req.body;   // frontend থেকে পাঠানো data

      try {
        const result = await contestColl.updateOne(
          { _id: new ObjectId(id) }, 
          { $set: updatedData }       
        );

        res.send(result); // MongoDB result return করবে
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });
    // delete contest
    app.delete("/contest/:id", async (req, res) => {
      const { id } = req.params;

      const query = {
        _id: new ObjectId(id)
      }
      const result = await contestColl.deleteOne(query);
      res.send(result)

       
    });
    app.patch('/contests/:id',async(req,res)=>{
      const status=req.body.status
      const id=req.params.id
      const query={_id:new ObjectId(id)}
      const updateDoc={
        $set:{
          status:status
        }
      }
      const result=await contestColl.updateOne(query,updateDoc)
      if(status==='approved'){
        const email=req.body.email
        const useQuery={email}
        const updateUser={
          $set:{
            role:'contestCreator'
          }
        }
        const userResult=await contestColl.updateOne(useQuery,updateUser)
      }
      res.send(result)
    })
   

    // payment related api

    app.post('/create-checkout-session', async (req, res) => {
      const paymentInfo=req.body
      const amount=parseInt(paymentInfo.price)*100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
           
           price_data:{
            currency:'USD',
            unit_amount:amount,
            product_data:{
              name:paymentInfo.name
            },
           },
           
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.email,
        mode: 'payment',
        metadata:{
          contestId:paymentInfo.contestId
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`
      });

     console.log(session)
      res.send({ url: session.url })
    });



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error

  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})