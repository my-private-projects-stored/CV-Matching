(function initReplicaSet() {
  const rsName = "rs0";
  const memberHost = "mongo:27017";

  try {
    const status = rs.status();
    if (status && status.ok === 1) {
      print(`[mongo-init-replica] Replica set '${rsName}' is already initialized.`);
      return;
    }
  } catch (err) {
    print(`[mongo-init-replica] rs.status() check: ${err.message}. Proceeding to rs.initiate()...`);
  }

  const initResult = rs.initiate({
    _id: rsName,
    members: [{ _id: 0, host: memberHost }],
  });
  print(`[mongo-init-replica] rs.initiate() result: ${JSON.stringify(initResult)}`);

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const hello = rs.hello();
    if (hello && hello.isWritablePrimary === true) {
      print(`[mongo-init-replica] Replica set '${rsName}' PRIMARY elected on attempt ${attempt}.`);
      return;
    }
    sleep(1000);
  }

  throw new Error(`[mongo-init-replica] Timed out waiting for '${rsName}' PRIMARY election.`);
})();
