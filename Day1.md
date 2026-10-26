C:\Users\ojhap\OneDrive>mongosh "mongodb+srv://cluster0.zxpnpi3.mongodb.net/" --apiVersion 1 --username ojhasanay_db_user
Enter password: ****************
Current Mongosh Log ID: 6adec4cd6ad421e93001143e
Connecting to:          mongodb+srv://<credentials>@cluster0.zxpnpi3.mongodb.net/?appName=mongosh+2.10.0
Using MongoDB:          8.0.34 (API Version 1)
Using Mongosh:          2.10.0
mongosh 2.14.0 is available for download: https://www.mongodb.com/try/download/shell

For mongosh info see: https://www.mongodb.com/docs/mongodb-shell/

Atlas atlas-yl4z6k-shard-0 [primary] test> show dbs
admin  0 B
local  0 B
Atlas atlas-yl4z6k-shard-0 [primary] test> db.createCollection("student")
{ ok: 1 }
Atlas atlas-yl4z6k-shard-0 [primary] test> use("E-Commerce")
switched to db E-Commerce
Atlas atlas-yl4z6k-shard-0 [primary] E-Commerce> db.createCollection("Products")
{ ok: 1 }
Atlas atlas-yl4z6k-shard-0 [primary] E-Commerce> db.Products.insertOne({
|       Name:"Iphone 10 S",
|       ProductionYr:2024,
|       ProcessorDetails:{
|               Processor:"Gen6",
|               CPU:4,
|               Threads:16,
|       },
|       CameraSpec:{
|               Camera:"48px",
|               Sensor:"IR Grade",
|               MotionCapture:True,
|       },
|       Available:False,
| })
ReferenceError: True is not defined
Atlas atlas-yl4z6k-shard-0 [primary] E-Commerce> db.Products.insertOne({
|       Name:"Iphone 10 S",
|       ProductionYr:2024,
|       ProcessorDetails:{
|               Processor:"Gen6",
|               CPU:4,
|               Threads:16,
|       },
|       CameraSpec:{
|               Camera:"48px",
|               Sensor:"IR Grade",
|               MotionCapture:True,
|       },
|       Available:False,
| })
ReferenceError: True is not defined
Atlas atlas-yl4z6k-shard-0 [primary] E-Commerce> db.Products.insertOne({
|       Name:"Iphone 10 S",
|       ProductionYr:2024,
|       ProcessorDetails:{
|               Processor:"Gen6",
|               CPU:4,
|               Threads:16,
|       },
|       CameraSpec:{
|               Camera:"48px",
|               Sensor:"IR Grade",
|               MotionCapture:true,
|       },
|       Available:false,
| })
{
  acknowledged: true,
  insertedId: ObjectId('6adec9ec6ad421e93001143f')
}
Atlas atlas-yl4z6k-shard-0 [primary] E-Commerce> db.products.insertMany([
|     {
|         Name: "Iphone 10 S",
|         ProductionYr: 2024,
|         ProcessorDetails: {
|             Processor: "Gen6",
|             CPU: 4,
|             Threads: 16
|         },
|         CameraSpec: {
|             Camera: "48px",
|             Sensor: "IR Grade",
|             MotionCapture: true
|         },
|         Available: false
|     },
|     {
|         Name: "Iphone 11",
|         ProductionYr: 2024,
|         ProcessorDetails: {
|             Processor: "Gen7",
|             CPU: 6,
|             Threads: 12
|         },
|         CameraSpec: {
|             Camera: "50px",
|             Sensor: "CMOS",
|             MotionCapture: true
|         },
|         Available: true
|     },
|     {
|         Name: "Iphone 12",
|         ProductionYr: 2023,
|         ProcessorDetails: {
|             Processor: "Gen6",
|             CPU: 4,
|             Threads: 8
|         },
|         CameraSpec: {
|             Camera: "48px",
|             Sensor: "IR Grade",
|             MotionCapture: false
|         },
|         Available: true
|     },
|     {
|         Name: "Iphone 13",
|         ProductionYr: 2023,
|         ProcessorDetails: {
|             Processor: "Gen8",
|             CPU: 8,
|             Threads: 16
|         },
|         CameraSpec: {
|             Camera: "64px",
|             Sensor: "CMOS",
|             MotionCapture: true
|         },
|         Available: true
|     },
|     {
|         Name: "Iphone 14",
|         ProductionYr: 2022,
|         ProcessorDetails: {
|             Processor: "Gen8",
|             CPU: 6,
|             Threads: 12
|         },
|         CameraSpec: {
|             Camera: "48px",
|             Sensor: "IR Grade",
|             MotionCapture: true
|         },
|         Available: false
|     },
|     {
|         Name: "Iphone 15",
|         ProductionYr: 2022,
|         ProcessorDetails: {
|             Processor: "Gen9",
|             CPU: 8,
|             Threads: 16
|         },
|         CameraSpec: {
|             Camera: "50px",
|             Sensor: "CMOS",
|             MotionCapture: true
|         },
|         Available: true
|     },
|     {
|         Name: "Iphone 16",
|         ProductionYr: 2021,
|         ProcessorDetails: {
|             Processor: "Gen7",
|             CPU: 4,
|             Threads: 8
|         },
|         CameraSpec: {
|             Camera: "48px",
|             Sensor: "IR Grade",
|             MotionCapture: false
|         },
|         Available: true
|     },
|     {
|         Name: "Iphone 17",
|         ProductionYr: 2021,
|         ProcessorDetails: {
|             Processor: "Gen9",
|             CPU: 6,
|             Threads: 12
|         },
|         CameraSpec: {
|             Camera: "64px",
|             Sensor: "CMOS",
|             MotionCapture: true
|         },
|         Available: false
|     },
|     {
|         Name: "Iphone 18",
|         ProductionYr: 2020,
|         ProcessorDetails: {
|             Processor: "Gen8",
|             CPU: 4,
|             Threads: 8
|         },
|         CameraSpec: {
|             Camera: "48px",
|             Sensor: "IR Grade",
|             MotionCapture: true
|         },
|         Available: true
|     },
|     {
|         Name: "Iphone 19",
|         ProductionYr: 2020,
|         ProcessorDetails: {
|             Processor: "Gen10",
|             CPU: 8,
|             Threads: 16
|         },
|         CameraSpec: {
|             Camera: "50px",
|             Sensor: "CMOS",
|             MotionCapture: true
|         },
|         Available: true
|     }
| ])
{
  acknowledged: true,
  insertedIds: {
    '0': ObjectId('6adeca3c6ad421e930011440'),
    '1': ObjectId('6adeca3c6ad421e930011441'),
    '2': ObjectId('6adeca3c6ad421e930011442'),
    '3': ObjectId('6adeca3c6ad421e930011443'),
    '4': ObjectId('6adeca3c6ad421e930011444'),
    '5': ObjectId('6adeca3c6ad421e930011445'),
    '6': ObjectId('6adeca3c6ad421e930011446'),
    '7': ObjectId('6adeca3c6ad421e930011447'),
    '8': ObjectId('6adeca3c6ad421e930011448'),
    '9': ObjectId('6adeca3c6ad421e930011449')
  }


use college

db.createCollection("students")

db.students.insertMany([
    { name: "Rahul", age: 20, branch: "CSE", marks: 85 },
    { name: "Aman", age: 21, branch: "ECE", marks: 78 },
    { name: "Priya", age: 19, branch: "CSE", marks: 92 },
    { name: "Rohit", age: 22, branch: "IT", marks: 67 },
    { name: "Neha", age: 20, branch: "ECE", marks: 88 }
])

db.students.find()

db.students.findOne()

db.students.find({ branch: "CSE" })

db.students.find({ marks: { $gt: 80 } })

db.students.find({ age: { $gte: 20 } })

db.students.find({ $or: [{ branch: "CSE" }, { branch: "IT" }] })

db.students.find({}, { name: 1, marks: 1, _id: 0 })

db.students.find().sort({ marks: -1 })

db.students.find().limit(3)

db.students.find().skip(2)

db.students.countDocuments({})

db.students.distinct("branch")

db.students.updateOne({ name: "Rahul" }, { $set: { marks: 95 } })

db.students.findOne({ name: "Rahul" })

db.students.updateOne({ name: "Aman" }, { $inc: { age: 1 } })

db.students.updateOne({ name: "Priya" }, { $set: { skills: ["Java", "MongoDB", "Python"] } })

db.students.updateOne({ name: "Priya" }, { $push: { skills: "Spring Boot" } })

db.students.find({ name: "Priya" })

db.students.aggregate([{ $group: { _id: "$branch", totalStudents: { $sum: 1 } } }])

db.students.aggregate([{ $group: { _id: null, averageMarks: { $avg: "$marks" } } }])

db.students.aggregate([{ $group: { _id: null, highestMarks: { $max: "$marks" } } }])

db.students.createIndex({ name: 1 })

db.students.getIndexes()

db.students.deleteOne({ name: "Rohit" })

db.students.countDocuments({})

db.students.find()
