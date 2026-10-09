import { config } from "dotenv";
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import fs from 'node:fs/promises';
import { z } from 'zod';
import { fileURLToPath } from "node:url";

// 从项目目录读取 .env，不受运行命令时所在目录影响。
config({
    path: fileURLToPath(new URL("../.env", import.meta.url)),
    quiet: true,
});

const apiKey = process.env.DEEPSEEK_API_KEY;
const baseURL = process.env.DEEPSEEK_BASE_URL;
const modelName = process.env.DEEPSEEK_MODEL_NAME;
if (!apiKey) {
    console.error("缺少 DEEPSEEK_API_KEY，请在 tool-test/.env 中填写 API Key。");
    process.exit(1);
}
if (!baseURL) {
    console.error("缺少 DEEPSEEK_BASE_URL，请在 tool-test/.env 中填写接口地址。");
    process.exit(1);
}
if (!modelName) {
    console.error("缺少 DEEPSEEK_MODEL_NAME，请在 tool-test/.env 中填写模型名称。");
    process.exit(1);
}

const model = new ChatOpenAI({
    model: modelName,
    apiKey,
    configuration: {
        baseURL,
    },
    timeout: 30_000,
    maxRetries: 0,
});

console.log("正在请求 DeepSeek…");

const readFileTool = tool(
    async ({ filePath }) => {
        const content = await fs.readFile(filePath, "utf-8");
        console.log(` [工具调用] read_file: ${filePath} - 成果读取 ${content.length} 字节`);
        return `文件内容如下：\n ${content}`;
    },
    {
        name: "read_file",
        description: "用此工具来读取文件内容。当用户要求读取文件、查看代码、分析文件内容时，调用此工具。输入文件路径（可以是相对路径或者绝对路径）",
        schema: z.object({
            filePath: z.string().describe("要读取的文件路径"),
        }),
    }
);

const tools = [readFileTool];

const modelWithTools = model.bindTools(tools);

/** @type {import("@langchain/core/messages").BaseMessage[]} */
const messages = [
    new SystemMessage(`你是一个代码助手，可以使用工具读取文件并解释代码。
            工作流程：
            1. 当用户要求读取文件、查看代码、分析文件内容时，调用 read_file 工具。
            2. 等待工具返回文件内容
            3. 基于文件内容进行分析和解释

            可用工具：
            - read_file: 用于读取文件内容（使用此工具来获取文件内容）
        `),

    new HumanMessage("请读取 src/tool-file-read.mjs 文件内容并解释代码"),
]

let respons = await modelWithTools.invoke(messages);

console.log(respons);

messages.push(respons);

// 处理工具调用
while (respons.tool_calls && respons.tool_calls.length > 0) {
    console.log(`\n[检测到 ${respons.tool_calls.length} 个工具调用]`);

    // 执行所有工具调用
    const toolResults = await Promise.all(
        respons.tool_calls.map(async (toolCall) => {
            // 查找工具
            const foundTool = tools.find((t) => t.name === toolCall.name);
            if (!foundTool) {
                throw new Error(`未找到工具: ${toolCall.name}`);
            }
            // 执行工具
            console.log(` [执行工具] ${toolCall.name}(${JSON.stringify(toolCall.args)})`);
            try {
                const args = foundTool.schema.parse(toolCall.args);
                const result = await foundTool.invoke(args);
                return result;
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                return `工具调用失败: ${errorMessage}`;
            }
        })
    )

    // 将工具调用结果添加到消息中
    respons.tool_calls.forEach((result, index) => {
        const toolCall = respons.tool_calls?.[index];
        if (!toolCall?.id) {
            throw new Error(`第 ${index + 1} 个工具调用缺少 id`);
        }
        messages.push(new ToolMessage({
            content: toolResults[index],
            tool_call_id: toolCall.id
        }))
    });

    // 再次调用模型，传入工具结果
    respons = await modelWithTools.invoke(messages);
}

console.log("\n[最终回复]");
console.log(respons.content);
