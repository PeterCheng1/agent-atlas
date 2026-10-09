import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { ChatOpenAI } from "@langchain/openai";

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

try {
    const response = await model.invoke("介绍自己");
    console.log(response.content);
} catch (error) {
    console.error("请求失败：", error.message);
    process.exitCode = 1;
}
