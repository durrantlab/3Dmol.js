// vrml/optimizers.ts
import { Vector3 } from "../WebGL/math";
import { ProcessedGeometryData } from "./types";

const AVERAGE_COLORS = true; // If false, use the first vertex color instead of averaging

/**
 * Merges vertices that are closer than the specified distance.
 * This is the core logic for the 'mergeVertices' optimization.
 * It also averages normals for the merged vertices.
 */
export function mergeVertices(
    data: ProcessedGeometryData,
    mergeDist: number,
    ignoreColors = false
): ProcessedGeometryData {
    if (mergeDist === undefined || mergeDist <= 0) return data;
    const mergeDistSq = mergeDist * mergeDist;
    const newVerts: { x: number; y: number; z: number }[] = [];
    const newNormalsData: { x: number; y: number; z: number; count: number }[] =
        [];
    const newColorsData: { r: number; g: number; b: number; count: number }[] =
        [];
    const newColRef: { r: number; g: number; b: number }[] = []; // Store reference colors for comparison
    const oldToNewMap = new Int32Array(data.vertices.length).fill(-1);
    const grid: { [key: string]: number[] } = {};
    const cellSize = mergeDist;

    for (let i = 0; i < data.vertices.length; i++) {
        const v = data.vertices[i];
        const c = data.colors.length > i ? data.colors[i] : null;
        const n_in = data.normals.length > i ? data.normals[i] : null;

        const gx = Math.floor(v.x / cellSize);
        const gy = Math.floor(v.y / cellSize);
        const gz = Math.floor(v.z / cellSize);

        let found = false;
        // Search in a 3x3x3 grid neighborhood
        for (let dx = -1; dx <= 1 && !found; dx++) {
            for (let dy = -1; dy <= 1 && !found; dy++) {
                for (let dz = -1; dz <= 1 && !found; dz++) {
                    const gridKey = `${gx + dx},${gy + dy},${gz + dz}`;
                    if (grid[gridKey]) {
                        for (const newIdx of grid[gridKey]) {
                            const nv = newVerts[newIdx];
                            const distSq =
                                (v.x - nv.x) ** 2 +
                                (v.y - nv.y) ** 2 +
                                (v.z - nv.z) ** 2;
                            if (distSq < mergeDistSq) {
                                // Check if colors match if they exist and ignoreColors is false
                                if (!ignoreColors && c && newColRef[newIdx]) {
                                    const refCol = newColRef[newIdx];
                                    const colorDistSq =
                                        (c.r - refCol.r) ** 2 +
                                        (c.g - refCol.g) ** 2 +
                                        (c.b - refCol.b) ** 2;
                                    if (colorDistSq > 1e-6) continue; // Skip if colors don't match
                                }

                                oldToNewMap[i] = newIdx;
                                if (n_in) {
                                    newNormalsData[newIdx].x += n_in.x;
                                    newNormalsData[newIdx].y += n_in.y;
                                    newNormalsData[newIdx].z += n_in.z;
                                    newNormalsData[newIdx].count++;
                                }
                                if (c) {
                                    newColorsData[newIdx].r += c.r;
                                    newColorsData[newIdx].g += c.g;
                                    newColorsData[newIdx].b += c.b;
                                    newColorsData[newIdx].count++;
                                }
                                found = true;
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (!found) {
            const newIndex = newVerts.length;
            oldToNewMap[i] = newIndex;
            newVerts.push(v);
            if (n_in) {
                newNormalsData.push({
                    x: n_in.x,
                    y: n_in.y,
                    z: n_in.z,
                    count: 1,
                });
            }
            if (c) {
                newColorsData.push({
                    r: c.r,
                    g: c.g,
                    b: c.b,
                    count: 1,
                });
                newColRef.push({
                    r: c.r,
                    g: c.g,
                    b: c.b,
                });
            }
            const gridKey = `${gx},${gy},${gz}`;
            if (!grid[gridKey]) grid[gridKey] = [];
            grid[gridKey].push(newIndex);
        }
    }

    const newFaces = data.faces.map((oldIndex) => oldToNewMap[oldIndex]);

    const newNormals = newNormalsData.map((n) => {
        const len = Math.sqrt(n.x ** 2 + n.y ** 2 + n.z ** 2);
        return len > 0
            ? { x: n.x / len, y: n.y / len, z: n.z / len }
            : { x: 0, y: 0, z: 0 };
    });
    const newColors = newColorsData.map((c, index) => {
        if (AVERAGE_COLORS) {
            return {
                r: c.r / c.count,
                g: c.g / c.count,
                b: c.b / c.count,
            };
        } else {
            // Use the first vertex color (reference color) instead of averaging
            return newColRef[index];
        }
    });
    return {
        vertices: newVerts,
        normals: newNormals,
        colors: newColors,
        faces: newFaces,
    };
}

/**
 * Removes vertices that are not referenced by any face.
 * This is the core logic for the 'removeOrphanVertexes' optimization.
 */
export function removeOrphanVertices(
    data: ProcessedGeometryData
): ProcessedGeometryData {
    if (data.faces.length === 0) {
        return { vertices: [], normals: [], colors: [], faces: [] };
    }

    const used = new Uint8Array(data.vertices.length);
    for (const index of data.faces) {
        used[index] = 1;
    }

    let newVertexCount = 0;
    for (const u of used) if (u) newVertexCount++;

    if (newVertexCount === data.vertices.length) {
        return data; // No orphans found
    }

    const oldToNewMap = new Int32Array(data.vertices.length);
    const finalVertices: typeof data.vertices = [];
    const finalNormals: typeof data.normals = [];
    const finalColors: typeof data.colors = [];

    let finalIndex = 0;
    for (let i = 0; i < data.vertices.length; i++) {
        if (used[i]) {
            oldToNewMap[i] = finalIndex++;
            finalVertices.push(data.vertices[i]);
            if (data.normals.length > i) finalNormals.push(data.normals[i]);
            if (data.colors.length > i) finalColors.push(data.colors[i]);
        }
    }

    const finalFaces = data.faces.map((oldIndex) => oldToNewMap[oldIndex]);

    return {
        vertices: finalVertices,
        normals: finalNormals,
        colors: finalColors,
        faces: finalFaces,
    };
}


/**
 * Removes vertices that are only connected to 1 or 2 other vertices.
 * This helps clean up stray triangles and isolated geometry that can 
 * result from mesh simplification.
 *
 * @param {ProcessedGeometryData} data - The geometry data to clean.
 * @returns {ProcessedGeometryData} The cleaned geometry data.
 */
export function removeIsolatedVertices(
    data: ProcessedGeometryData
): ProcessedGeometryData {
    if (data.faces.length === 0) {
        return { vertices: [], normals: [], colors: [], faces: [] };
    }

    // Build adjacency map to count connections for each vertex
    const adjacency = new Map<number, Set<number>>();
 
    // Initialize adjacency map
    for (let i = 0; i < data.vertices.length; i++) {
        adjacency.set(i, new Set<number>());
    }

    // Populate adjacency map from faces
    for (let i = 0; i < data.faces.length; i += 3) {
        const v1 = data.faces[i];
        const v2 = data.faces[i + 1];
        const v3 = data.faces[i + 2];

        // Skip degenerate faces
        if (v1 === v2 || v1 === v3 || v2 === v3) continue;

        adjacency.get(v1)?.add(v2).add(v3);
        adjacency.get(v2)?.add(v1).add(v3);
        adjacency.get(v3)?.add(v1).add(v2);
    }

    // Find vertices with 3 or more connections (well-connected vertices)
    const validVertices = new Set<number>();
    for (const [vertexIndex, connections] of adjacency) {
        if (connections.size >= 3) {
            validVertices.add(vertexIndex);
        }
    }

    // If no vertices need to be removed, return original data
    if (validVertices.size === data.vertices.length) {
        return data;
    }

    // Create mapping from old to new vertex indices
    const oldToNewMap = new Map<number, number>();
    const finalVertices: typeof data.vertices = [];
    const finalNormals: typeof data.normals = [];
    const finalColors: typeof data.colors = [];

    let newIndex = 0;
    for (let i = 0; i < data.vertices.length; i++) {
        if (validVertices.has(i)) {
            oldToNewMap.set(i, newIndex++);
            finalVertices.push(data.vertices[i]);
            if (data.normals.length > i) finalNormals.push(data.normals[i]);
            if (data.colors.length > i) finalColors.push(data.colors[i]);
        }
    }

    // Filter faces to only include those with all valid vertices
    const finalFaces: number[] = [];
    for (let i = 0; i < data.faces.length; i += 3) {
        const v1 = data.faces[i];
        const v2 = data.faces[i + 1];
        const v3 = data.faces[i + 2];

        // Only include face if all vertices are valid
        if (validVertices.has(v1) && validVertices.has(v2) && validVertices.has(v3)) {
            const newV1 = oldToNewMap.get(v1)!;
            const newV2 = oldToNewMap.get(v2)!;
            const newV3 = oldToNewMap.get(v3)!;
   
            // Skip degenerate faces after remapping
            if (newV1 !== newV2 && newV1 !== newV3 && newV2 !== newV3) {
                finalFaces.push(newV1, newV2, newV3);
            }
        }
    }

    return {
        vertices: finalVertices,
        normals: finalNormals,
        colors: finalColors,
        faces: finalFaces,
    };
}

/**
 * Recomputes normals for a mesh.
 * @param {Array<{x: number, y: number, z: number}>} vertices - The vertices of the mesh.
 * @param {Array<number>} faces - The face indices of the mesh.
 * @returns {Array<{x: number, y: number, z: number}>} The recomputed normals.
 */
function recomputeNormals(
    vertices: { x: number; y: number; z: number }[],
    faces: number[]
): { x: number; y: number; z: number }[] {
    const normals = vertices.map(() => ({ x: 0, y: 0, z: 0 }));
    if (faces.length === 0) return normals;
    for (let i = 0; i < faces.length; i += 3) {
        const i1 = faces[i];
        const i2 = faces[i + 1];
        const i3 = faces[i + 2];

        // Skip degenerate faces
        if (i1 === i2 || i1 === i3 || i2 === i3) continue;

        const v1 = new Vector3(vertices[i1].x, vertices[i1].y, vertices[i1].z);
        const v2 = new Vector3(vertices[i2].x, vertices[i2].y, vertices[i2].z);
        const v3 = new Vector3(vertices[i3].x, vertices[i3].y, vertices[i3].z);
        const cb = new Vector3().subVectors(v3, v2);
        const ab = new Vector3().subVectors(v1, v2);
        const faceNormal = cb.cross(ab);
  
        // Check for degenerate triangles (zero area)
        const faceArea = faceNormal.length();
        if (faceArea < 1e-10) continue;
  
        // Normalize the face normal and weight by area
        faceNormal.normalize().multiplyScalar(faceArea);

        normals[i1].x += faceNormal.x;
        normals[i1].y += faceNormal.y;
        normals[i1].z += faceNormal.z;
        normals[i2].x += faceNormal.x;
        normals[i2].y += faceNormal.y;
        normals[i2].z += faceNormal.z;
        normals[i3].x += faceNormal.x;
        normals[i3].y += faceNormal.y;
        normals[i3].z += faceNormal.z;
    }

    // Normalize vertex normals and handle zero-length normals
    for (const n of normals) {
        const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
        if (len > 1e-10) {
            n.x /= len;
            n.y /= len;
            n.z /= len;
        } else {
            // Default normal for degenerate cases
            n.x = 0;
            n.y = 0;
            n.z = 1;
        }
    }
    return normals;
}
/**
 * Smooths a mesh using a variant of Laplacian smoothing.
 * This is the core logic for the 'smoothSurfaces' optimization.
 * @param {ProcessedGeometryData} data - The geometry data to smooth.
 * @param {number} numiter - The number of smoothing iterations.
 * @returns {ProcessedGeometryData} The smoothed geometry data.
 */
export function laplacianSmooth(
    data: ProcessedGeometryData,
    numiter: number
): ProcessedGeometryData {
    if (numiter <= 0) return data;
    let verts = data.vertices.map((v) => ({ ...v }));
    const faces = data.faces;
    const adj = new Array(verts.length);
    for (let i = 0; i < verts.length; i++) {
        adj[i] = new Set<number>();
    }
    for (let i = 0; i < faces.length; i += 3) {
        const v1 = faces[i];
        const v2 = faces[i + 1];
        const v3 = faces[i + 2];
        adj[v1].add(v2).add(v3);
        adj[v2].add(v1).add(v3);
        adj[v3].add(v1).add(v2);
    }
    const neighbors = adj.map((s) => Array.from(s));
    const wt = 1.0;
    const wt2 = 0.5;
    for (let k = 0; k < numiter; k++) {
        const tps = new Array(verts.length);
        for (let i = 0; i < verts.length; i++) {
            const i_neighbors = neighbors[i];
            const n_neighbors = i_neighbors.length;
            if (n_neighbors < 3) {
                tps[i] = { ...verts[i] };
            } else {
                let w = n_neighbors === 3 || n_neighbors === 4 ? wt2 : wt;
                const avg = { x: 0, y: 0, z: 0 };
                for (const neighbor_idx of i_neighbors) {
                    avg.x += verts[neighbor_idx as number].x;
                    avg.y += verts[neighbor_idx as number].y;
                    avg.z += verts[neighbor_idx as number].z;
                }
                avg.x += w * verts[i].x;
                avg.y += w * verts[i].y;
                avg.z += w * verts[i].z;
                const denom = w + n_neighbors;
                tps[i] = {
                    x: avg.x / denom,
                    y: avg.y / denom,
                    z: avg.z / denom,
                };
            }
        }
        verts = tps;
    }

    // Always recompute normals after smoothing
    const newNormals = recomputeNormals(verts, faces);
    return {
        vertices: verts,
        normals: newNormals,
        colors: data.colors,
        faces: data.faces,
    };
}

/**
 * Minimizes whitespace in a VRML string.
 * This is the core logic for the 'minimizeWhiteSpace' optimization.
 * It removes unnecessary spaces and leading/trailing whitespace while preserving newlines.
 *
 * @param vrmlTxt - The VRML text to optimize.
 * @returns The optimized VRML text with minimized whitespace.
 */
export function minimizeWhiteSpace(vrmlTxt: string): string {
    // Remove whitespace at the start of the line, end of the line, after commas, and empty lines
    return vrmlTxt
        .replace(/^\s+/gm, "") // Remove leading whitespace on each line
        .replace(/\s+$/gm, "") // Remove trailing whitespace on each line
        .replace(/\s*,\s*/g, ",") // Remove spaces around commas
        .replace(/\n\s*\n/g, "\n") // Remove empty lines
        .replace(/[ \t]+/g, " "); // Replace multiple spaces/tabs with a single space (but preserve newlines)
}
