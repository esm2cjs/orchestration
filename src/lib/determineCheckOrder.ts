import { GraphNode, topologicalSort } from "./graph";
import { isObject } from "./typeguards";
import { Context, Github } from "./types";

async function getOwnRepositories(github: Github): Promise<string[]> {
	const { data: repos } = await github.rest.repos.listForOrg({
		org: "esm2cjs",
		type: "forks",
	});

	const ret: string[] = [];

	for (const repo of repos) {
		// Check if package.json is already using our scope (or if this is a WIP)
		const { data: contents } = await github.rest.repos.getContent({
			owner: "esm2cjs",
			repo: repo.name,
			path: "package.json",
		});
		if (
			isObject(contents) &&
			contents.type === "file" &&
			"content" in contents
		) {
			const packageJson = JSON.parse(
				Buffer.from(contents.content, "base64").toString()
			);
			if (!packageJson.name.includes("@esm2cjs/")) continue;
		}
		ret.push(repo.name);
	}

	return ret;
}

async function getOwnDependencies(
	github: Github,
	repo: string,
	ownRepos: string[]
): Promise<string[]> {
	const { data: contents } = await github.rest.repos.getContent({
		owner: "esm2cjs",
		repo,
		path: "package.json",
	});
	if (
		isObject(contents) &&
		contents.type === "file" &&
		"content" in contents
	) {
		const packageJson = JSON.parse(
			Buffer.from(contents.content, "base64").toString()
		);
		const ret: string[] = [];
		if (isObject(packageJson.dependencies)) {
			for (const [dep, version] of Object.entries<string>(
				packageJson.dependencies
			)) {
				if (
					ownRepos.includes(dep) &&
					version.includes(`@esm2cjs/${dep}`)
				) {
					ret.push(dep);
				}
			}
		}
		if (isObject(packageJson.devDependencies)) {
			for (const [dep, version] of Object.entries<string>(
				packageJson.devDependencies
			)) {
				if (
					ownRepos.includes(dep) &&
					version.includes(`@esm2cjs/${dep}`)
				) {
					ret.push(dep);
				}
			}
		}

		return ret;
	} else {
		return [];
	}
}

// Builds a graph of "own" dependencies and sorts it topologically, to determine the order in which to check the repositories.
export async function determineCheckOrder(param: {
	github: Github;
	context: Context;
}) {
	const { github, context } = param;

	const ownRepos = await getOwnRepositories(github);
	const graph = ownRepos.map((repo) => new GraphNode(repo));

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

	const checkOrder = topologicalSort(graph);
	return checkOrder;
}

export async function getDefaultBranch(
	param: {
		github: Github;
		context: Context;
	},
	repo: string
): Promise<string> {
	const { github, context } = param;

	const { data: repoInfo } = await github.rest.repos.get({
		owner: "esm2cjs",
		repo,
	});
	return repoInfo.default_branch;
}
