// vrml/optimizers.ts
import { GeometryGroup } from "../WebGL";
import { ProcessedGeometryData } from "./types";

/**
 * Merges vertices that are closer than the specified distance.
 * This is the core logic for the 'mergeVertices' optimization.
 * It also averages normals for the merged vertices.
 */
export function mergeVertices(
    geoGroup: GeometryGroup,
    mergeDist: number
): ProcessedGeometryData {
    const mergeDistSq = mergeDist * mergeDist;
    const newVertices: { x: number; y: number; z: number }[] = [];
    const newNormalsData: { x: number; y: number; z: number; count: number }[] = [];
    const newColors: { r: number; g: number; b: number }[] = [];
    const oldToNewMap = new Int32Array(geoGroup.vertices).fill(-1);
    const grid: { [key: string]: number[] } = {};
    const cellSize = mergeDist;

    for (let i = 0; i < geoGroup.vertices; i++) {
        const offset = i * 3;
        const v = {
            x: geoGroup.vertexArray[offset],
            y: geoGroup.vertexArray[offset + 1],
            z: geoGroup.vertexArray[offset + 2],
        };
        const c = geoGroup.colorArray
            ? {
                  r: geoGroup.colorArray[offset],
                  g: geoGroup.colorArray[offset + 1],
                  b: geoGroup.colorArray[offset + 2],
              }
            : null;

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
                        for (const newIndex of grid[gridKey]) {
                            const nv = newVertices[newIndex];
                            const distSq = (v.x - nv.x) ** 2 + (v.y - nv.y) ** 2 + (v.z - nv.z) ** 2;

                            if (distSq < mergeDistSq) {
                                // Check if colors match if they exist
                                if (c) {
                                    const nc = newColors[newIndex];
                                    const colorDistSq = (c.r - nc.r) ** 2 + (c.g - nc.g) ** 2 + (c.b - nc.b) ** 2;
                                    if (colorDistSq > 1e-6) continue;
                                }

                                oldToNewMap[i] = newIndex;
                                if (geoGroup.normalArray) {
                                    newNormalsData[newIndex].x += geoGroup.normalArray[offset];
                                    newNormalsData[newIndex].y += geoGroup.normalArray[offset + 1];
                                    newNormalsData[newIndex].z += geoGroup.normalArray[offset + 2];
                                    newNormalsData[newIndex].count++;
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
            const newIndex = newVertices.length;
            oldToNewMap[i] = newIndex;
            newVertices.push(v);
            if (geoGroup.normalArray) {
                newNormalsData.push({
                    x: geoGroup.normalArray[offset],
                    y: geoGroup.normalArray[offset + 1],
                    z: geoGroup.normalArray[offset + 2],
                    count: 1,
                });
            }
            if (c) newColors.push(c);

            const gridKey = `${gx},${gy},${gz}`;
            if (!grid[gridKey]) grid[gridKey] = [];
            grid[gridKey].push(newIndex);
        }
    }

    const newFaces = Array.from(geoGroup.faceArray).map(oldIndex => oldToNewMap[oldIndex]);
    const newNormals = newNormalsData.map(n => {
        const len = Math.sqrt(n.x ** 2 + n.y ** 2 + n.z ** 2);
        return len > 0 ? { x: n.x / len, y: n.y / len, z: n.z / len } : { x: 0, y: 0, z: 0 };
    });

    return { vertices: newVertices, normals: newNormals, colors: newColors, faces: newFaces };
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
    for(const u of used) if(u) newVertexCount++;

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

    const finalFaces = data.faces.map(oldIndex => oldToNewMap[oldIndex]);

    return {
        vertices: finalVertices,
        normals: finalNormals,
        colors: finalColors,
        faces: finalFaces,
    };
}