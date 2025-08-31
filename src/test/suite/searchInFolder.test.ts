import * as assert from 'assert';
import * as path from 'path';
import { RipgrepService } from '../../ripgrepService';
import { SearchResult } from '../../searchProvider';

async function runFolderTests() {
    const ripgrepService = new RipgrepService();
    // Go back to src directory from out/test/suite
    const testDataPath = path.join(__dirname, '../../../src/test/test_data/test_folder');

    console.log('Running searchInFolder tests...');

    // Test 1: Find matches across multiple files
    try {
        const results = await ripgrepService.searchInFolder(testDataPath, 'Lorem');
        assert.strictEqual(results.length, 6, 'Should find 6 matches for "Lorem" across both files');
        
        // Check that we have results from both files
        const file1Results = results.filter(r => r.file.includes('test_file_1.txt'));
        const file2Results = results.filter(r => r.file.includes('test_file_2.txt'));
        
        assert.strictEqual(file1Results.length, 3, 'Should find 3 matches in test_file_1.txt');
        assert.strictEqual(file2Results.length, 3, 'Should find 3 matches in test_file_2.txt');
        
        console.log('✓ Find matches across multiple files');
    } catch (error: any) {
        console.log('✗ Find matches across multiple files:', error.message);
    }

    // Test 2: Verify line numbers are correct for both files
    try {
        const results = await ripgrepService.searchInFolder(testDataPath, 'Lorem');
        
        // Check line numbers for first file
        const file1Results = results.filter(r => r.file.includes('test_file_1.txt'));
        const file1Lines = file1Results.map(r => r.line).sort((a, b) => a - b);
        assert.deepStrictEqual(file1Lines, [1, 10, 19], 'File 1 should have matches on lines 1, 10, 19');
        
        // Check line numbers for second file  
        const file2Results = results.filter(r => r.file.includes('test_file_2.txt'));
        const file2Lines = file2Results.map(r => r.line).sort((a, b) => a - b);
        assert.deepStrictEqual(file2Lines, [1, 10, 19], 'File 2 should have matches on lines 1, 10, 19');
        
        console.log('✓ Verify line numbers are correct for both files');
    } catch (error: any) {
        console.log('✗ Verify line numbers are correct for both files:', error.message);
    }

    // Test 3: Context lines are properly included for folder search
    try {
        const results = await ripgrepService.searchInFolder(testDataPath, 'Lorem');
        
        results.forEach((result, i) => {
            assert.ok(result.context.length >= 2, `Result ${i + 1} should have at least 2 context lines (using --context 2 for folder search)`);
        });
        
        console.log('✓ Context lines are properly included for folder search');
    } catch (error: any) {
        console.log('✗ Context lines are properly included for folder search:', error.message);
    }

    // Test 4: Return empty array for no matches in folder
    try {
        const results = await ripgrepService.searchInFolder(testDataPath, 'nonexistent');
        assert.strictEqual(results.length, 0, 'Should return empty array for no matches in folder');
        console.log('✓ Return empty array for no matches in folder');
    } catch (error: any) {
        console.log('✗ Return empty array for no matches in folder:', error.message);
    }

    // Test 5: Case insensitive search in folder
    try {
        const results = await ripgrepService.searchInFolder(testDataPath, 'lorem');
        assert.strictEqual(results.length, 6, 'Should return 6 matches for lowercase "lorem" (case insensitive) in folder');
        console.log('✓ Case insensitive search in folder');
    } catch (error: any) {
        console.log('✗ Case insensitive search in folder:', error.message);
    }

    // Test 6: File paths are correctly formatted
    try {
        const results = await ripgrepService.searchInFolder(testDataPath, 'Lorem');
        
        results.forEach((result, i) => {
            assert.ok(result.file.includes('test_file_'), `Result ${i + 1} should have correct filename in path`);
            assert.ok(result.file.endsWith('.txt'), `Result ${i + 1} should have .txt extension`);
        });
        
        console.log('✓ File paths are correctly formatted');
    } catch (error: any) {
        console.log('✗ File paths are correctly formatted:', error.message);
    }

    // Test 7: Detailed folder search analysis
    try {
        const results = await ripgrepService.searchInFolder(testDataPath, 'Lorem');
        
        console.log('\nDetailed folder search analysis:');
        console.log(`Total results: ${results.length}`);
        
        const groupedByFile = results.reduce((acc, result) => {
            const fileName = path.basename(result.file);
            if (!acc[fileName]) {
                acc[fileName] = [];
            }
            acc[fileName].push(result);
            return acc;
        }, {} as Record<string, SearchResult[]>);
        
        Object.entries(groupedByFile).forEach(([fileName, fileResults]) => {
            console.log(`\n${fileName}:`);
            fileResults.forEach((result, i) => {
                console.log(`  Match ${i + 1} at line ${result.line}:`);
                console.log(`    Text: "${result.text}"`);
                console.log(`    Context lines: ${result.context.length}`);
            });
        });
        
        console.log('\n✓ Detailed folder search analysis completed');
    } catch (error: any) {
        console.log('✗ Detailed folder search analysis:', error.message);
    }

    console.log('All searchInFolder tests completed!');
}

if (require.main === module) {
    runFolderTests().catch(console.error);
}

export { runFolderTests };
