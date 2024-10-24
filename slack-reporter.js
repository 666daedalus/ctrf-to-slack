#!/usr/bin/env node

import path from 'path';
import axios from 'axios';
import fs from 'fs'
import {Command} from 'commander'

const program = new Command();

program
    .requiredOption('--slackWebhookUrl <url>', 'Slack webhook URL')
    .requiredOption('--ctrfPath <path>', 'Path to CTRF-json file')
    .requiredOption('--title <name>', 'Title of the message')
    .requiredOption('--platform <name>', 'Platform')
    .option('--buildName <name>', 'Build name')
    .option('--buildUrl <url>', 'Build URL')
    .option('--sourceBranch <name>', 'Source branch')
    .option('--environment <name>', 'Test environment')

program.parse(process.argv);

const options = program.opts();

function parseCtrfJson(filePath) {
    const absolutePath = path.resolve(filePath);
    let data;
    try {
        data = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
    }
    catch (error) {
        console.error('Error while reading CTRF-json file:', error.message);
        process.exit(1);
    }


    const toolName = data.results.tool.name;
    const summary = {
        totalTests: data.results.summary.tests,
        successfulTests: data.results.summary.passed,
        failedTests: data.results.summary.failed,
        skippedTests: data.results.summary.skipped,
        pendingTests: data.results.summary.pending,
        otherTests: data.results.summary.other,
        startTime: data.results.summary.start,
        stopTime: data.results.summary.stop
    }
    return {toolName, summary};
}

function generateSlackMessage({toolName, summary}) {
    const resultEmoji = summary.failedTests > 0 ? "❌" : "✅";
    const resultStatus = summary.failedTests > 0 ? "Failed" : "Passed";
    const totalDuration = new Date(summary.stopTime - summary.startTime).toISOString().substr(11, 8);

    let message = `*${options.title}*\n`;
    message += `${resultEmoji} ${summary.successfulTests} | ❌ ${summary.failedTests} | ⏸️ ${summary.skippedTests} | ⌛ ${summary.pendingTests} | ❓${summary.otherTests}\n`;
    message += `>*Result:* ${resultStatus}\n`;
    message += `>*Duration:* ${totalDuration}\n`;
    options.platform ? message += `>*Platform:* ${options.platform}\n` : '';
    options.buildName && options.buildUrl ? message += `>*Build:* <${options.buildUrl}|${options.buildName}>\n` : '';
    options.sourceBranch ? message += `>*Source branch:* ${options.sourceBranch}\n` : '';
    options.environment ? message += `>*Environment:* ${options.environment}\n` : '';

    return `${message}` + '\n'
}

async function sendToSlack(message) {
    try {
        await axios.post(options.slackWebhookUrl, {
            text: message
        });
    } catch (error) {
        console.error('Error while sending message to Slack:', error.message);
    }
}

async function main() {
    const testsData = parseCtrfJson(options.ctrfPath);
    const message = generateSlackMessage(testsData);
    await sendToSlack(message);
}

await main();
