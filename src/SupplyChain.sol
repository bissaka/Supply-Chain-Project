// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/// @title SupplyChain - Tracks products through a supply chain using the Ethereum blockchain.
contract SupplyChain {
    // Define possible product statuses
    enum Status { Created, InTransit, Delivered }

    // Structure to store product details
    struct Product {
        uint256 id;
        address currentOwner;
        Status status;
    }

    // Mapping of product IDs to product details
    mapping(uint256 => Product) private products;

    // Events to log changes for off-chain monitoring
    event ProductAdded(uint256 indexed productId, address owner);
    event OwnershipTransferred(uint256 indexed productId, address previousOwner, address newOwner);
    event StatusUpdated(uint256 indexed productId, Status newStatus);

    /// @notice Add a new product to the supply chain.
    /// @param productId The unique identifier of the product.
    /// @param owner The initial owner of the product.
    function addProduct(uint256 productId, address owner) external {
        require(products[productId].id == 0, "Product already exists");
        products[productId] = Product({ id: productId, currentOwner: owner, status: Status.Created });
        emit ProductAdded(productId, owner);
    }

    /// @notice Transfer the ownership of a product.
    /// @param productId The identifier of the product.
    /// @param newOwner The Ethereum address of the new owner.
    function transferOwnership(uint256 productId, address newOwner) external {
        require(products[productId].id != 0, "Product not found");
        require(products[productId].currentOwner == msg.sender, "Only current owner can transfer");
        address prevOwner = products[productId].currentOwner;
        products[productId].currentOwner = newOwner;
        emit OwnershipTransferred(productId, prevOwner, newOwner);
    }

    /// @notice Update the status of a product.
    /// @param productId The identifier of the product.
    /// @param newStatus The new status (0 = Created, 1 = InTransit, 2 = Delivered).
    function updateStatus(uint256 productId, Status newStatus) external {
        require(products[productId].id != 0, "Product not found");
        require(products[productId].currentOwner == msg.sender, "Only current owner can update status");
        products[productId].status = newStatus;
        emit StatusUpdated(productId, newStatus);
    }

    /// @notice Retrieve the details of a product.
    /// @param productId The identifier of the product.
    /// @return owner The current owner’s Ethereum address.
    /// @return status The current status of the product.
    function getProduct(uint256 productId) external view returns (address owner, Status status) {
        require(products[productId].id != 0, "Product not found");
        Product memory p = products[productId];
        return (p.currentOwner, p.status);
    }
}