const response = await fetch("http://127.0.0.1:4173/api/health");
if (!response.ok)
  throw new Error("Start the application before checking database status.");
console.log(JSON.stringify(await response.json(), null, 2));
