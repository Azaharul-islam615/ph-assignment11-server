const express = require('express')
const cors=require ('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
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

    const db=client.db('contesthub_db')
    const contestColl=db.collection('contestCollection')
//  constest api
    app.get('/contest',async(req,res)=>{
        const query={}
        const {email}=req.query
        const cursor=contestColl.find(query)
        const result=await cursor.toArray()
        res.send(result)
    })

    app.get('/contest',async(req,res)=>{
      const query={}
      if(req.query.status){
        query.status=req.query.status
      }
      const cursor=contestColl.find(query)
      const result=await cursor.toArray()
      res.send(result)
    })

    app.post("/contest", async(req,res)=>{
        const contest=req.body
        contest.status='pending'
        contest.createdAt=new Date()
        const result=await contestColl.insertOne(contest)
        res.send(result)
    })

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