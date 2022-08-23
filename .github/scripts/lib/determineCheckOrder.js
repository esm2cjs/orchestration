"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultBranch = exports.determineCheckOrder = void 0;
const graph_1 = require("./graph");
const typeguards_1 = require("./typeguards");
async function getOwnRepositories(github) {
    const { data: repos } = await github.rest.repos.listForOrg({
        org: "esm2cjs",
        type: "forks",
    });
    const ret = [];
    for (const repo of repos) {
        // Check if package.json is already using our scope (or if this is a WIP)
        const { data: contents } = await github.rest.repos.getContent({
            owner: "esm2cjs",
            repo: repo.name,
            path: "package.json",
        });
        if ((0, typeguards_1.isObject)(contents) &&
            contents.type === "file" &&
            "content" in contents) {
            const packageJson = JSON.parse(Buffer.from(contents.content, "base64").toString());
            if (!packageJson.name.includes("@esm2cjs/"))
                continue;
        }
        ret.push(repo.name);
    }
    return ret;
}
async function getOwnDependencies(github, repo, ownRepos) {
    const { data: contents } = await github.rest.repos.getContent({
        owner: "esm2cjs",
        repo,
        path: "package.json",
    });
    function isOwn(dep, version) {
        // variant 1: `"foo": "npm:@esm2cjs/foo@^1.0.0"`
        if (ownRepos.includes(dep) && version.includes(`@esm2cjs/${dep}`)) {
            return true;
        }
        // variant 2: `"@esm2cjs/foo": "^1.0.0"`
        if (ownRepos.some((r) => `@esm2cjs/${r}` === dep)) {
            return true;
        }
        return false;
    }
    if ((0, typeguards_1.isObject)(contents) &&
        contents.type === "file" &&
        "content" in contents) {
        const packageJson = JSON.parse(Buffer.from(contents.content, "base64").toString());
        const ret = [];
        if ((0, typeguards_1.isObject)(packageJson.dependencies)) {
            for (const [dep, version] of Object.entries(packageJson.dependencies)) {
                if (isOwn(dep, version)) {
                    github.log.info(`dependency ${dep}@${version} is ours, adding to list`);
                    ret.push(dep.replace(/^@esm2cjs\//, ""));
                }
                else {
                    github.log.info(`dependency ${dep}@${version} is not ours`);
                }
            }
        }
        if ((0, typeguards_1.isObject)(packageJson.devDependencies)) {
            for (const [dep, version] of Object.entries(packageJson.devDependencies)) {
                if (isOwn(dep, version)) {
                    github.log.info(`devDependency ${dep}@${version} is ours, adding to list`);
                    ret.push(dep.replace(/^@esm2cjs\//, ""));
                }
                else {
                    github.log.info(`devDependency ${dep}@${version} is not ours`);
                }
            }
        }
        return ret;
    }
    else {
        return [];
    }
}
// Builds a graph of "own" dependencies and sorts it topologically, to determine the order in which to check the repositories.
async function determineCheckOrder(param) {
    const { github, context } = param;
    const ownRepos = await getOwnRepositories(github);
    const graph = ownRepos.map((repo) => new graph_1.GraphNode(repo));
    for (const repoNode of graph) {
        const repo = repoNode.value;
        const deps = await getOwnDependencies(github, repo, ownRepos);
        for (const dep of deps) {
            const depNode = graph.find((node) => node.value === dep);
            if (depNode) {
                repoNode.edges.add(depNode);
            }
        }
    }
    const checkOrder = (0, graph_1.topologicalSort)(graph);
    return checkOrder;
}
exports.determineCheckOrder = determineCheckOrder;
async function getDefaultBranch(param, repo) {
    const { github, context } = param;
    const { data: repoInfo } = await github.rest.repos.get({
        owner: "esm2cjs",
        repo,
    });
    return repoInfo.default_branch;
}
exports.getDefaultBranch = getDefaultBranch;
