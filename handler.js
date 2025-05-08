// Import required libraries from AWS SDK and ethers.js
const {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
} = require("@aws-sdk/client-dynamodb");
const { ethers } = require("ethers");
const { abi: contractABI } = require("./SupplyChainABI.json");

// Initialize AWS SDK client for DynamoDB, specifying the AWS region
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGIONS });

// Setup connection to Ethereum Sepolia using ethers.js
// The SEPOLIA_RPC_URL and PRIVATE_KEY are stored as environment variables for security.
const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Retrieve the contract address from environment variables
const contractAddress = process.env.CONTRACT_ADDRESS;

// Create a contract instance to interact with the deployed SupplyChain contract.
const contract = new ethers.Contract(contractAddress, contractABI, signer);

// Helper function to send HTTP responses
const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(body),
});

// The main Lambda handler function
exports.lambdaHandler = async (event) => {
  try {
    // Extract the HTTP route and method from the event object.
    const route = event.path;
    const httpMethod = event.httpMethod;
    // Parse the request body, if available.
    const input = JSON.parse(event.body || "{}");

    //  Adding a new product
    if (route === "/product" && httpMethod === "POST") {
      const productId = input.id;
      const ownerAddr = input.owner;

      // Call the smart contract function addProduct
      const tx = await contract.addProduct(productId, ownerAddr);
      await tx.wait(); // Wait for the transaction to be mined

      console.log(`Product ${productId} added on blockchain by ${ownerAddr}`);

      // Log before DynamoDB write
      console.log("Attempting to write product metadata to DynamoDB");

      // Save product metadata to DynamoDB
      const params = {
        TableName: "Products",
        Item: {
          ProductID: { N: productId.toString() },
          Owner: { S: ownerAddr },
          Status: { S: "Created" },
          LastUpdate: { S: new Date().toISOString() },
        },
      };
      await ddbClient.send(new PutItemCommand(params));

      // Log success
      console.log("Successfully wrote product metadata to DynamoDB");

      return response(201, { message: "Product added", productId });
    }

    //  Transferring ownership of a product
    if (route.match(/^\/product\/(\d+)\/transfer$/) && httpMethod === "PUT") {
      const productId = route.split("/")[2];
      const newOwner = input.newOwner;
      const tx = await contract.transferOwnership(productId, newOwner);
      await tx.wait();
      console.log(`Ownership of ${productId} transferred to ${newOwner}`);

      const params = {
        TableName: "Products",
        Key: { ProductID: { N: productId } },
        UpdateExpression: "SET #owner = :newOwner, LastUpdate = :now",
        ExpressionAttributeNames: {
          "#owner": "Owner",
        },
        ExpressionAttributeValues: {
          ":newOwner": { S: newOwner },
          ":now": { S: new Date().toISOString() },
        },
      };
      await ddbClient.send(new UpdateItemCommand(params));
      return response(200, {
        message: "Ownership transferred",
        productId,
        newOwner,
      });
    }

    //  Updating the status of a product
    if (route.match(/^\/product\/(\d+)\/status$/) && httpMethod === "PUT") {
      const productId = route.split("/")[2];
      const newStatus = input.status; // e.g., "Delivered" or "InTransit"
      let statusEnum;
      if (newStatus === "InTransit") statusEnum = 1;
      else if (newStatus === "Delivered") statusEnum = 2;
      else statusEnum = 0;
      const tx = await contract.updateStatus(productId, statusEnum);
      await tx.wait();
      console.log(`Status of ${productId} updated to ${newStatus}`);

      const params = {
        TableName: "Products",
        Key: { ProductID: { N: productId } },
        UpdateExpression: "SET #status = :newStatus, LastUpdate = :now",
        ExpressionAttributeNames: {
          "#status": "Status",
        },
        ExpressionAttributeValues: {
          ":newStatus": { S: newStatus },
          ":now": { S: new Date().toISOString() },
        },
      };
      await ddbClient.send(new UpdateItemCommand(params));
      return response(200, {
        message: "Status updated",
        productId,
        status: newStatus,
      });
    }

    //  Retrieving product information
    if (
      httpMethod === "GET" &&
      event.pathParameters &&
      event.pathParameters.id
    ) {
      const productId = event.pathParameters.id;
      const params = {
        TableName: "Products",
        Key: { ProductID: { N: productId } },
      };
      const data = await ddbClient.send(new GetItemCommand(params));
      if (!data.Item) {
        return response(404, { error: "Product not found" });
      }
      const item = data.Item;
      const result = {
        productId,
        owner: item.Owner.S,
        status: item.Status.S,
        lastUpdate: item.LastUpdate.S,
      };
      return response(200, result);
    }

    // If the route or method does not match any handler, return an error.
    return response(400, { error: "Bad request or unsupported route" });
  } catch (err) {
    console.error("Error processing request", err);
    // Check if the error message indicates that the product already exists
    if (err.message && err.message.includes("Product already exists")) {
      return response(409, { error: "Product already exists" });
    }
    // Check if the error message indicates that only the current owner can transfer
    if (
      err.message &&
      err.message.includes("Only current owner can transfer")
    ) {
      return response(409, { error: "Only current owner can transfer" });
    }
    // Check if the error message indicates that Only current owner can update status
    if (
      err.message &&
      err.message.includes("Only current owner can update status")
    ) {
      return response(409, { error: "Only current owner can update status" });
    }
    return response(500, {
      error: "Internal Server Error",
      details: err.message,
    });
  }
};
