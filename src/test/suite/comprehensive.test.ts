import * as assert from 'assert';
import * as path from 'path';
import { RipgrepService } from '../../ripgrepService';

async function runComprehensiveTests() {
    console.log('Running comprehensive RipgrepService tests...\n');
    
    // Import and run individual test suites
    const searchInFileTests = require('./searchInFile.test.js');
    const searchInFolderTests = require('./searchInFolder.test.js');
    
    // Run file search tests
    console.log('=== FILE SEARCH TESTS ===');
    await searchInFileTests.default();
    
    console.log('\n=== FOLDER SEARCH TESTS ===');
    await searchInFolderTests.runFolderTests();
    
    // Additional integration tests
    console.log('\n=== INTEGRATION TESTS ===');
    
    const ripgrepService = new RipgrepService();
    const testDataPath = path.join(__dirname, '../../../src/test/test_data/test_folder');
    const testFile1 = path.join(testDataPath, 'test_file_1.txt');
    
    // Test 1: searchWithQuery method with file
    try {
        const results = await ripgrepService.searchWithQuery(testFile1, 'Lorem', true);
        assert.strictEqual(results.length, 3, 'searchWithQuery should work for files');
        console.log('✓ searchWithQuery works for files');
    } catch (error: any) {
        console.log('✗ searchWithQuery works for files:', error.message);
    }
    
    // Test 2: searchWithQuery method with folder
    try {
        const results = await ripgrepService.searchWithQuery(testDataPath, 'Lorem', false);
        assert.strictEqual(results.length, 6, 'searchWithQuery should work for folders');
        console.log('✓ searchWithQuery works for folders');
    } catch (error: any) {
        console.log('✗ searchWithQuery works for folders:', error.message);
    }
    
    // Test 3: Empty query handling
    try {
        const results = await ripgrepService.searchWithQuery(testDataPath, '', false);
        assert.strictEqual(results.length, 0, 'Empty query should return empty results');
        console.log('✓ Empty query handling');
    } catch (error: any) {
        console.log('✗ Empty query handling:', error.message);
    }
    
    // Test 4: Whitespace-only query handling
    try {
        const results = await ripgrepService.searchWithQuery(testDataPath, '   ', false);
        assert.strictEqual(results.length, 0, 'Whitespace-only query should return empty results');
        console.log('✓ Whitespace-only query handling');
    } catch (error: any) {
        console.log('✗ Whitespace-only query handling:', error.message);
    }
    
    console.log('\nAll comprehensive tests completed!');
}

if (require.main === module) {
    runComprehensiveTests().catch(console.error);
}
