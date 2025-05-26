const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    console.log('Starting cleanup-buffs function');
    
    if (event.httpMethod !== 'POST') {
        console.log('Invalid method:', event.httpMethod);
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            console.error('GitHub token not configured');
            return {
                statusCode: 500,
                body: JSON.stringify({ error: 'GitHub token not configured' })
            };
        }

        console.log('GitHub token found, proceeding with cleanup');

        // Get current date and calculate cutoff date (1 day ago)
        const now = new Date();
        const cutoffDate = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 1 day ago
        console.log('Cutoff date:', cutoffDate.toISOString());

        // Process both faction files
        const factions = ['horde', 'alliance'];
        const results = {};

        for (const faction of factions) {
            try {
                console.log(`Processing ${faction} file...`);
                const path = faction === 'horde' ? 'horde_buffs.json' : 'alliance_buffs.json';
                
                // Fetch current file content and SHA
                console.log(`Fetching ${path} from GitHub...`);
                const fileResponse = await fetch(`https://api.github.com/repos/cougtrades/wowbuffs/contents/${path}`, {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3+json'
                    }
                });

                if (!fileResponse.ok) {
                    const errorData = await fileResponse.json();
                    console.error(`GitHub API error for ${path}:`, errorData);
                    throw new Error(`Failed to fetch ${faction} file: ${errorData.message || fileResponse.statusText}`);
                }

                const fileData = await fileResponse.json();
                console.log(`Successfully fetched ${path}, parsing content...`);
                
                let currentContent;
                try {
                    currentContent = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
                } catch (parseError) {
                    console.error(`Error parsing ${path}:`, parseError);
                    throw new Error(`Failed to parse ${faction} file content: ${parseError.message}`);
                }
                
                // Filter out old entries
                const oldEntries = currentContent.filter(buff => new Date(buff.datetime) < cutoffDate);
                const newContent = currentContent.filter(buff => new Date(buff.datetime) >= cutoffDate);
                console.log(`${faction}: Found ${oldEntries.length} old entries to remove`);

                // If there are entries to remove, update the file
                if (oldEntries.length > 0) {
                    console.log(`Updating ${path} on GitHub...`);
                    const updateResponse = await fetch(`https://api.github.com/repos/cougtrades/wowbuffs/contents/${path}`, {
                        method: 'PUT',
                        headers: {
                            Authorization: `token ${token}`,
                            Accept: 'application/vnd.github.v3+json'
                        },
                        body: JSON.stringify({
                            message: `Cleanup ${faction} buffs: Remove ${oldEntries.length} old entries`,
                            content: Buffer.from(JSON.stringify(newContent, null, 4)).toString('base64'),
                            sha: fileData.sha
                        })
                    });

                    if (!updateResponse.ok) {
                        const errorData = await updateResponse.json();
                        console.error(`GitHub API error updating ${path}:`, errorData);
                        throw new Error(`Failed to update ${faction} file: ${errorData.message || updateResponse.statusText}`);
                    }

                    console.log(`Successfully updated ${path}`);
                    results[faction] = {
                        removed: oldEntries.length,
                        remaining: newContent.length,
                        removedEntries: oldEntries
                    };
                } else {
                    console.log(`No old entries to remove from ${path}`);
                    results[faction] = {
                        removed: 0,
                        remaining: currentContent.length,
                        message: 'No old entries to remove'
                    };
                }
            } catch (factionError) {
                console.error(`Error processing ${faction} file:`, factionError);
                results[faction] = {
                    error: factionError.message
                };
            }
        }

        console.log('Cleanup completed successfully');
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Cleanup completed successfully',
                results
            })
        };
    } catch (error) {
        console.error('Error in cleanup-buffs:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: error.message,
                details: error.stack,
                timestamp: new Date().toISOString()
            })
        };
    }
}; 
