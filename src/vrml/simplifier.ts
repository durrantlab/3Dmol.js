// vrml/simplifier.ts
import { ProcessedGeometryData } from "./types";
import { Vector3 } from "../WebGL/math";
import { Color } from "../colors";

interface SimplificationVertex {
    position: Vector3;
    normal: Vector3;
    color: Color;
    id: number;
    weight: number;
}

class DisjointSet {
    parent: number[];
    constructor(n: number) {
        this.parent = new Array(n);
        for (let i = 0; i < n; i++) {
            this.parent[i] = i;
        }
    }

    find(i: number): number {
        if (this.parent[i] === i) {
            return i;
        }
        return this.parent[i] = this.find(this.parent[i]);
    }

    union(i: number, j: number): number {
        const rootI = this.find(i);
        const rootJ = this.find(j);
        if (rootI !== rootJ) {
            this.parent[rootJ] = rootI;
            return rootI;
        }
        return rootI;
    }
}

/**
 * Simplifies a mesh using an iterative edge collapse algorithm based on edge length.
 * The simplification is controlled by a target ratio of vertices to retain.
 *
 * @param {ProcessedGeometryData} data - The geometry data to simplify.
 * @param {number} ratio - The target ratio of vertices to retain (e.g., 0.5 for 50%).
 * @returns {ProcessedGeometryData} The simplified geometry data.
 */
export function simplifyMesh(
    data: ProcessedGeometryData,
    ratio: number
): ProcessedGeometryData {
    if (ratio >= 1.0) {
        return data;
    }

    const vertices: SimplificationVertex[] = [];
    for (let i = 0; i < data.vertices.length; i++) {
        vertices.push({
            position: new Vector3(data.vertices[i].x, data.vertices[i].y, data.vertices[i].z),
            normal: data.normals.length > i ? new Vector3(data.normals[i].x, data.normals[i].y, data.normals[i].z) : new Vector3(0, 0, 0),
            color: data.colors.length > i ? new Color(data.colors[i].r, data.colors[i].g, data.colors[i].b) : new Color(0.5, 0.5, 0.5),
            id: i,
            weight: 1,
        });
    }

    const faces = [];
    for (let i = 0; i < data.faces.length; i += 3) {
        faces.push([data.faces[i], data.faces[i + 1], data.faces[i + 2]]);
    }

    const edges: { v1: number; v2: number; cost: number }[] = [];
    const edgeMap = new Set<string>();
    for (const face of faces) {
        for (let i = 0; i < 3; i++) {
            const v1 = face[i];
            const v2 = face[(i + 1) % 3];
            const key1 = `${Math.min(v1,v2)}_${Math.max(v1,v2)}`;
            if (!edgeMap.has(key1)) {
                edges.push({ v1, v2, cost: vertices[v1].position.distanceToSquared(vertices[v2].position) });
                edgeMap.add(key1);
            }
        }
    }

    edges.sort((a, b) => a.cost - b.cost);

    const numVertices = vertices.length;
    const targetVertices = Math.floor(ratio * numVertices);
    const verticesToRemove = numVertices - targetVertices;
    let removedCount = 0;

    const disjointSet = new DisjointSet(numVertices);

    for (const edge of edges) {
        if (removedCount >= verticesToRemove) break;

        const root1 = disjointSet.find(edge.v1);
        const root2 = disjointSet.find(edge.v2);

        if (root1 !== root2) {
            const v1 = vertices[root1];
            const v2 = vertices[root2];
            
            // Weighted average for position, normal, and color
            const w1 = v1.weight;
            const w2 = v2.weight;
            const totalWeight = w1 + w2;

            v1.position.multiplyScalar(w1).add(v2.position.clone().multiplyScalar(w2)).divideScalar(totalWeight);
            v1.normal.multiplyScalar(w1).add(v2.normal.clone().multiplyScalar(w2)).divideScalar(totalWeight).normalize();
            v1.color.r = (v1.color.r * w1 + v2.color.r * w2) / totalWeight;
            v1.color.g = (v1.color.g * w1 + v2.color.g * w2) / totalWeight;
            v1.color.b = (v1.color.b * w1 + v2.color.b * w2) / totalWeight;
            v1.weight = totalWeight;

            disjointSet.union(root1, root2);
            removedCount++;
        }
    }

    const newVertices: { x: number; y: number; z: number }[] = [];
    const newNormals: { x: number; y: number; z: number }[] = [];
    const newColors: { r: number; g: number; b: number }[] = [];
    const oldToNewMap = new Int32Array(numVertices).fill(-1);
    let newIndex = 0;

    for (let i = 0; i < numVertices; i++) {
        if (disjointSet.parent[i] === i) {
            oldToNewMap[i] = newIndex++;
            const v = vertices[i];
            newVertices.push({ x: v.position.x, y: v.position.y, z: v.position.z });
            newNormals.push({ x: v.normal.x, y: v.normal.y, z: v.normal.z });
            newColors.push({ r: v.color.r, g: v.color.g, b: v.color.b });
        }
    }

    const newFaces: number[] = [];
    for (const face of faces) {
        const v1 = oldToNewMap[disjointSet.find(face[0])];
        const v2 = oldToNewMap[disjointSet.find(face[1])];
        const v3 = oldToNewMap[disjointSet.find(face[2])];
        if (v1 !== v2 && v1 !== v3 && v2 !== v3) {
            newFaces.push(v1, v2, v3);
        }
    }

    return { vertices: newVertices, normals: newNormals, colors: newColors, faces: newFaces };
}