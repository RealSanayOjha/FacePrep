// Run against ONE intended mongod. Safe to rerun after initialization.
try {
  const status = rs.status();
  if (status.set !== "rs0") throw new Error("Refusing to modify a different replica set: " + status.set);
  print("Replica set rs0 is already initialized.");
} catch (error) {
  if (error.code !== 94 && error.codeName !== "NotYetInitialized") throw error;
  printjson(rs.initiate({
    _id: "rs0",
    members: [
      { _id: 0, host: "mongo1:27017", priority: 3 },
      { _id: 1, host: "mongo2:27017", priority: 2 },
      { _id: 2, host: "mongo3:27017", priority: 1 }
    ]
  }));
}
let elected = false;
for (let attempt = 0; attempt < 60; attempt++) {
  if (db.hello().isWritablePrimary) { elected = true; break; }
  sleep(1000);
}
if (!elected) throw new Error("No writable primary after 60 seconds.");
print("rs0 has a writable primary.");
