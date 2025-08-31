import * as assert from 'assert';
import * as path from 'path';
import { RipgrepService } from '../../ripgrepService';
import { SearchResult } from '../../searchProvider';

async function runTests() {
    const ripgrepService = new RipgrepService();
    // Go back to src directory from out/test/suite
    const testDataPath = path.join(__dirname, '../../../src/test/test_data/test_folder');
    const testFile1 = path.join(testDataPath, 'test_file_1.txt');
    const testFile2 = path.join(testDataPath, 'test_file_2.txt');

    console.log('Running searchInFile tests...');

    // Test 1: Find matches in test file
    try {
        const results = await ripgrepService.searchInFile(testFile1, 'Lorem');
        assert.strictEqual(results.length, 3, 'Should find 3 matches for "Lorem"');
        assert.strictEqual(results[0].line, 1, 'First match should be on line 1');
        assert.strictEqual(results[1].line, 10, 'Second match should be on line 10');
        assert.strictEqual(results[2].line, 19, 'Third match should be on line 19');
        console.log('✓ Find matches in test file');
    } catch (error: any) {
        console.log('✗ Find matches in test file:', error.message);
    }

    // Test 2: Find matches with column information
    try {
        const results = await ripgrepService.searchInFile(testFile1, 'ipsum');
        assert.strictEqual(results.length, 3, 'Should find 3 matches for "ipsum"');
        results.forEach((result: SearchResult) => {
            assert.strictEqual(result.column, 7, 'Column should be 7 for all "ipsum" matches');
        });
        console.log('✓ Find matches with column information');
    } catch (error: any) {
        console.log('✗ Find matches with column information:', error.message);
    }

    // Test 3: Include context lines properly
    try {
        const results = await ripgrepService.searchInFile(testFile1, 'Lorem');
        assert.strictEqual(results.length, 3, 'Should find 3 matches for "Lorem"');
        
        // First match (line 1) should have context lines after it
        assert.ok(results[0].context.length >= 3, 'First match should have at least 3 context lines');
        assert.ok(results[0].context.includes('Quisque faucibus ex sapien vitae pellentesque sem placerat.'), 'Should include expected context');
        
        // Second match (line 10) should have context lines before and after
        assert.ok(results[1].context.length >= 3, 'Second match should have at least 3 context lines');
        
        // Third match (line 19) should have context lines before it  
        assert.ok(results[2].context.length >= 3, 'Third match should have at least 3 context lines');
        
        console.log('✓ Include context lines properly');
    } catch (error: any) {
        console.log('✗ Include context lines properly:', error.message);
    }

    // Test 4: Return empty array for no matches
    try {
        const results = await ripgrepService.searchInFile(testFile1, 'nonexistent');
        assert.strictEqual(results.length, 0, 'Should return empty array for no matches');
        console.log('✓ Return empty array for no matches');
    } catch (error: any) {
        console.log('✗ Return empty array for no matches:', error.message);
    }

    // Test 5: Handle case insensitive search
    try {
        const results = await ripgrepService.searchInFile(testFile1, 'lorem');
        assert.strictEqual(results.length, 3, 'Should return 3 matches for lowercase "lorem" (case insensitive)');
        console.log('✓ Handle case insensitive search');
    } catch (error: any) {
        console.log('✗ Handle case insensitive search:', error.message);
    }

    // Test 6: Context lines should not bleed between matches
    try {
        const results = await ripgrepService.searchInFile(testFile1, 'Lorem');
        // Each match should have its own separate context
        const allContextLines = results.flatMap(r => r.context);
        const uniqueContextLines = [...new Set(allContextLines)];
        
        // Context from different matches shouldn't be identical collections
        assert.notStrictEqual(JSON.stringify(results[0].context), JSON.stringify(results[1].context), 
            'Context lines should be different between matches');
        
        console.log('✓ Context lines properly separated between matches');
    } catch (error: any) {
        console.log('✗ Context lines properly separated between matches:', error.message);
    }

    // Test 7: Detailed context verification
    try {
        const results = await ripgrepService.searchInFile(testFile1, 'Lorem');
        
        console.log('\nDetailed context analysis:');
        results.forEach((result, i) => {
            console.log(`Match ${i + 1} at line ${result.line}:`);
            console.log(`  Text: "${result.text}"`);
            console.log(`  Context lines (${result.context.length}):`);
            result.context.forEach((ctx, j) => {
                console.log(`    ${j + 1}: "${ctx}"`);
            });
            console.log('');
        });
        
        console.log('✓ Detailed context verification completed');
    } catch (error: any) {
        console.log('✗ Detailed context verification:', error.message);
    }

    console.log('All searchInFile tests completed!');
}

if (require.main === module) {
    runTests().catch(console.error);
}