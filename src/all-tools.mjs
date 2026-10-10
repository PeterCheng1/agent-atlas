import { tool } from '@langchain/core/tools';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { z } from 'zod';

// 1. 读取文件工具
const readFileTool = tool(
    async ({ filePath }) => {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            console.log(` [工具调用] read_file: ${filePath} - 成果读取 ${content.length} 字节`);
            return `文件内容如下：\n ${content}`;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(` [工具调用] read_file: ${filePath} - 读取失败: ${errorMessage}`);
            return `读取文件失败: ${errorMessage}`;
        }
    },
    {
        name: 'read_file',
        description: '读取指定路径的文件内容',
        schema: z.object({
            filePath: z.string().describe('要读取的文件路径'),
        }),
    }
)

// 2. 写入文件工具
const writeFileTool = tool(
    async({ filePath, content})=>{
        try {
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(filePath, content, 'utf-8');
            console.log(` [工具调用] write_file: ${filePath} - 成功写入 ${content.length} 字节`);
            return `文件写入成功: ${filePath}`;
        } catch(error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(` [工具调用] write_file: ${filePath} - 写入失败: ${errorMessage}`);
            return `文件写入失败: ${errorMessage}`;
        }
    },
    {
        name: 'write_file',
        description: '向指定路径写入文件内容，自动创建目录',
        schema: z.object({
            filePath: z.string().describe('要写入的文件路径'),
            content: z.string().describe('要写入的内容'),
        }),
    }
)

// 3. 执行命令工具（带实时输出）
const executeCommandTool = tool(
    async({ command, workingDirectory })=>{
        const cwd = workingDirectory || process.cwd();
        console.log(` [工具调用] execute_command: ${command} - 在目录 ${cwd} 执行`);

        return new Promise((resolve, reject)=>{
            // 解析命令和参数
            const [cmd, ...args] = command.split(" ");

            // 执行命令
            const child = spawn(cmd, args, {
                cwd,
                stdio: "inherit", // 继承父进程的标准输入输出
                shell: true, // 使用 shell 执行命令
            })

            let errorMsg = "";

            // 监听错误事件
            child.on("error", (error) => {
                // 处理命令执行错误
                errorMsg = error.message;
            })

            // 监听退出事件
            child.on('close', (code)=>{
                if(code === 0) {
                    console.log(` [工具调用] execute_command: ${command} - 执行成功`);
                    const cwdInfo = workingDirectory 
                    ? `\n\n 重要提示：命令在目录 “${workingDirectory}” 中执行成功，如果需要在这个项目目录中继续执行命令，请使用 workingDirectory："${workingDirectory}" 参数，不用使用 cd 命令` 
                    : "";
                    resolve(`命令执行成功: ${command}${cwdInfo}`);
                } else {
                    // 处理命令执行失败的情况
                    if (errorMsg) {
                        reject(new Error(`命令执行失败: ${errorMsg}`));
                    }
                }
            })
        })
    },
    {
        name: 'execute_command',
        description: '执行系统命令，支持指定工作目录，实时显示输出',
        schema: z.object({
            command: z.string().describe('要执行的命令'),
            workingDirectory: z.string().optional().describe('工作目录（推荐指定）'),
        }),
    }
)

// 4. 列出目录内容工具
const listDirectoryTool = tool(
    async ({ directoryPath }) => {
        try {
            const files = await fs.readdir(directoryPath);
            console.log(` [工具调用] list_directory: ${directoryPath} - 成功列出 ${files.length} 个文件/目录`);
            return `目录内容如下：\n ${files.join('\n')}`;
        } catch(error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(` [工具调用] list_directory: ${directoryPath} - 列出失败: ${errorMessage}`);
            return `列出目录失败: ${errorMessage}`;
        }
    },
    {
        name: 'list_directory',
        description: '列出指定目录的文件和子目录',
        schema: z.object({
            directoryPath: z.string().describe('目录路径'),
        }),
    }
)

export { readFileTool, writeFileTool, executeCommandTool, listDirectoryTool };