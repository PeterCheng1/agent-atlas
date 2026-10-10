import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { executeCommandTool, listDirectoryTool, readFileTool, writeFileTool } from './all-tools.mjs';
import chalk from 'chalk';

const model = new ChatOpenAI({
    model: process.env.DEEPSEEK_MODEL_NAME,
    apiKey: process.env.DEEPSEEK_API_KEY,
    configuration: {
        baseURL: process.env.DEEPSEEK_BASE_URL,
    },
    timeout: 30_000,
    maxRetries: 0,
    temperature: 0,
});

/** @type {import("@langchain/core/tools").StructuredToolInterface[]} */
const tools = [readFileTool, writeFileTool, listDirectoryTool, executeCommandTool];

// 将工具绑定到模型
const modelWithTools = model.bindTools(tools);

// Agent 执行函数
/**
 * @param {string} query 用户输入的任务描述。
 * @param {number} [maxIterations=30] 最大执行轮数。
 */
async function runAgentWithTools(query, maxIterations = 30) {
    /** @type {import("@langchain/core/messages").BaseMessage[]} */
    const messages = [new SystemMessage(`
        你是一个项目管理助手，使用工作完成任务
        
        当前做工作目标：${process.cwd()}

        工具：
        1. read_file: 读取文件
        2. write_file: 写入文件
        3. execute_command: 执行命令（支持 workingDirectory 参数）
        4. list_directory: 列出目录

        重要规则 - execute_command：
        - workingDirectory 参数会自动切换到指定目录
        - 当使用 workingDirectory 参数时，绝不能在 command 中使用 cd 
        - 错误示例：{ "command": "cd react-todo-app && pnpm install", "workingDirectory": "react-todo-app" }
        这是错误的！因为 workingDirectory 已经在 react-todo-app 目录下了，command 中不应该再使用 cd，会导致最终找不到目录
        - 正确示例：{ "command": "pnpm install", "workingDirectory": "react-todo-app" }
        这样就对了！workingDirectory 已经切换到 react-todo-app 目录，直接执行命令即可

        回答要简洁，只说做了什么
    `),
    new HumanMessage(query)];

    for (let i = 0; i < maxIterations; i++) {
        console.log(chalk(`\n=== 第 ${i + 1} 轮 正在等待 AI 思考===`));
        // 调用 LLM
        const response = await modelWithTools.invoke(messages);
        messages.push(response);

        // 检查是否在工具调用
        if(!response.tool_calls || response.tool_calls.length === 0) {
            console.log(`\n AI 最终回复：\n ${response.content}`);
            return response.content;
        }

        // 执行工具调用
        for (const toolCall of response.tool_calls) {
            const foundTool = tools.find(t => t.name === toolCall.name);
            if(foundTool) {
                if (!toolCall.id) {
                    throw new Error(`工具调用 ${toolCall.name} 缺少 id`);
                }
                const toolResult = await foundTool.invoke(toolCall.args);

                messages.push(new ToolMessage({
                    content: toolResult,
                    tool_call_id: toolCall.id
                }))
            }
        }
    }

    // 返回回答序列最新一个回复内容
    return messages[messages.length - 1].content;
}

// Todo App 测试任务。String.raw 保留命令中的 \n，交给 shell 处理。
const case1 = String.raw`创建一个功能丰富的 React TodoList 应用：

1. 创建项目：echo -e "n\nn" | pnpm create vite react-todo-app --template react-ts
   如果 react-todo-app 已存在，先检查目录内容，在现有项目上修改，不要删除或覆盖已有项目。
2. 修改 react-todo-app/src/App.tsx，实现完整功能的 TodoList：
   - 添加、删除、编辑、标记完成
   - 分类筛选（全部/进行中/已完成）
   - 统计信息展示
   - localStorage 数据持久化
3. 添加样式：
   - 渐变背景（蓝到紫）
   - 卡片阴影、圆角
   - 悬停效果
4. 添加动画：
   - 添加/删除时的过渡动画
   - 使用 CSS transitions
5. 列出项目目录确认文件已生成。

注意：使用 pnpm，功能要完整，样式要美观，要有动画效果。

之后在 react-todo-app 项目中：
1. 使用 pnpm install 安装依赖。
2. 使用 pnpm run build 检查项目能否构建，若失败则修复并重新检查。
3. 最后告诉我如何在 react-todo-app 目录执行 pnpm run dev 启动服务。
   不要通过 execute_command 启动 pnpm run dev，因为它是常驻进程，当前工具会一直等待它退出。

执行项目内命令时，使用 workingDirectory 参数指定 react-todo-app，不要在 command 中使用 cd。
`;

try {
    await runAgentWithTools(case1);
} catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`\n❌ 错误：${errorMessage}\n`));
    process.exitCode = 1;
}
