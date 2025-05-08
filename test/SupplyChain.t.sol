// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

// Import Foundry's testing library.
import "forge-std/Test.sol";
// Import the contract to be tested.
import "../src/SupplyChain.sol";

contract SupplyChainTest is Test {
    SupplyChain supplyChain;
    // Pre-define some addresses for testing purposes.
    address owner = address(0xABCD);
    address newOwner = address(0x1234);

    // Setup runs before each test.
    function setUp() public {
        supplyChain = new SupplyChain();
    }

    // Test adding a product.
    function testAddProduct() public {
        uint256 productId = 1;
        supplyChain.addProduct(productId, owner);
        (address productOwner, SupplyChain.Status status) = supplyChain.getProduct(productId);
        assertEq(productOwner, owner, "Owner should be correctly set after product addition");
        assertEq(uint(status), 0, "Status should be Created (0)");
    }

    // Test transferring ownership.
    function testTransferOwnership() public {
        uint256 productId = 2;
        supplyChain.addProduct(productId, owner);

        // Simulate a transaction from 'owner' using Foundry's vm.prank.
        vm.prank(owner);
        supplyChain.transferOwnership(productId, newOwner);

        (address productOwner, ) = supplyChain.getProduct(productId);
        assertEq(productOwner, newOwner, "Ownership should be transferred to the new owner");
    }

    // Test updating product status.
    function testUpdateStatus() public {
        uint256 productId = 3;
        supplyChain.addProduct(productId, owner);

        // Simulate a transaction from 'owner' to update status.
        vm.prank(owner);
        supplyChain.updateStatus(productId, SupplyChain.Status.InTransit);

        (, SupplyChain.Status status) = supplyChain.getProduct(productId);
        assertEq(uint(status), 1, "Status should be updated to InTransit (1)");
    }

    // Test that only the current owner can transfer ownership.
    function testOnlyOwnerCanTransfer() public {
        uint256 productId = 4;
        supplyChain.addProduct(productId, owner);

        // Simulate a call from newOwner, who is not the current owner.
        vm.prank(newOwner);
        // Expect the call to revert with the proper error message.
        vm.expectRevert("Only current owner can transfer");
        supplyChain.transferOwnership(productId, newOwner);
    }
}