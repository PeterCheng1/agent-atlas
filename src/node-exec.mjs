import { spawn } from "child_process";

const commamd = 'echo -e "n\nn" | pnpm create vite react-todo-app --template react-ts';

const cwd = process.cwd();

// 解析命令和参数
const [cmd, ...args] = commamd.split(" ");

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
child.on("close", (code) => {
    // 根据退出码判断命令是否成功执行
    if (code === 0) {
        process.exit(0);
    } else {
        // 处理命令执行失败的情况
        if (errorMsg) {
            console.error(`命令执行失败: ${errorMsg}`);
        }
        process.exit(code);
    }
})