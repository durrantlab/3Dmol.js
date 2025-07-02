// vrml/generators.ts
import { Geometry, GeometryGroup, Material } from "../WebGL";
import { VRMLExportOptions, ProcessedGeometryData } from "./types";
import { formatCoord } from "./utils";
import {
    mergeVertices,
    removeOrphanVertices,
    removeIsolatedVertices,
    laplacianSmooth,
} from "./optimizers";
import { simplifyMesh } from "./simplifier";

/**
 * Generates an IndexedLineSet VRML string from a geometry group.
 */
export function generateIndexedLineSetString(
    geoGroup: GeometryGroup,
    material: Material,
    options: VRMLExportOptions,
    indent: string
): string {
    let output = indent + "geometry IndexedLineSet {\n";
    const geoIndent = indent + "  ";

    // Coordinates
    output += geoIndent + "coord Coordinate {\n";
    output += geoIndent + "  point [\n";
    for (let i = 0; i < geoGroup.vertices; ++i) {
        const offset = i * 3;
        output += `${geoIndent}    ${formatCoord(
            geoGroup.vertexArray[offset],
            options.precision
        )} ${formatCoord(
            geoGroup.vertexArray[offset + 1],
            options.precision
        )} ${formatCoord(
            geoGroup.vertexArray[offset + 2],
            options.precision
        )},\n`;
    }
    output += geoIndent + "  ]\n" + geoIndent + "}\n";

    // Colors
    if (geoGroup.colorArray && !material.wireframe) {
        output += geoIndent + "colorPerVertex TRUE\n";
        output += geoIndent + "color Color {\n";
        output += geoIndent + "  color [\n";
        for (let i = 0; i < geoGroup.vertices; ++i) {
            const offset = i * 3;
            output += `${geoIndent}    ${formatCoord(
                geoGroup.colorArray[offset],
                options.precision
            )} ${formatCoord(
                geoGroup.colorArray[offset + 1],
                options.precision
            )} ${formatCoord(
                geoGroup.colorArray[offset + 2],
                options.precision
            )},\n`;
        }
        output += geoIndent + "  ]\n" + geoIndent + "}\n";
    } else {
        output += geoIndent + "colorPerVertex FALSE\n";
    }

    // Indices
    output += geoIndent + "coordIndex [\n";
    if (material.wireframe && geoGroup.faceArray) {
        for (let i = 0; i < geoGroup.faceidx; i += 3) {
            output += `${geoIndent}  ${geoGroup.faceArray[i]}, ${
                geoGroup.faceArray[i + 1]
            }, ${geoGroup.faceArray[i + 2]}, -1,\n`;
        }
    } else {
        for (let i = 0; i < geoGroup.vertices - 1; i += 2) {
            output += `${geoIndent}  ${i}, ${i + 1}, -1,\n`;
        }
    }
    output += geoIndent + "]\n";
    output += indent + "}\n";
    return output;
}

/**
 * Recomputes normals for processed geometry data.
 * @param {ProcessedGeometryData} data - The geometry data.
 * @returns {ProcessedGeometryData} The data with recomputed normals.
 */
function recomputeNormalsForProcessedData(
    data: ProcessedGeometryData
): ProcessedGeometryData {
    const normals: { x: number; y: number; z: number }[] = data.vertices.map(
        () => ({ x: 0, y: 0, z: 0 })
    );

    if (data.faces.length === 0) {
        return { ...data, normals };
    }

    // Accumulate face normals
    for (let i = 0; i < data.faces.length; i += 3) {
        const i1 = data.faces[i];
        const i2 = data.faces[i + 1];
        const i3 = data.faces[i + 2];

        // Skip degenerate faces
        if (i1 === i2 || i1 === i3 || i2 === i3) continue;

        const v1 = data.vertices[i1];
        const v2 = data.vertices[i2];
        const v3 = data.vertices[i3];

        // Calculate face normal using cross product
        const u = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
        const v = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };

        const normal = {
            x: u.y * v.z - u.z * v.y,
            y: u.z * v.x - u.x * v.z,
            z: u.x * v.y - u.y * v.x,
        };

        // Check for degenerate triangles
        const length = Math.sqrt(
            normal.x * normal.x + normal.y * normal.y + normal.z * normal.z
        );
        if (length < 1e-10) continue;

        // Normalize and weight by area
        normal.x = (normal.x / length) * length;
        normal.y = (normal.y / length) * length;
        normal.z = (normal.z / length) * length;

        // Add to vertex normals
        normals[i1].x += normal.x;
        normals[i1].y += normal.y;
        normals[i1].z += normal.z;

        normals[i2].x += normal.x;
        normals[i2].y += normal.y;
        normals[i2].z += normal.z;

        normals[i3].x += normal.x;
        normals[i3].y += normal.y;
        normals[i3].z += normal.z;
    }

    // Normalize vertex normals
    for (const n of normals) {
        const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
        if (len > 1e-10) {
            n.x /= len;
            n.y /= len;
            n.z /= len;
        } else {
            // Default normal for problematic vertices
            n.x = 0;
            n.y = 0;
            n.z = 1;
        }
    }

    return { ...data, normals };
}

/**
 * Generates an IndexedFaceSet VRML string, applying optimizations as needed.
 */
export function generateIndexedFaceSetString(
    geoGroup: GeometryGroup,
    options: VRMLExportOptions,
    indent: string,
    geometry: Geometry
): string {
    // Convert geoGroup to ProcessedGeometryData first
    const vertices = [];
    const normals = [];
    const colors = [];
    for (let i = 0; i < geoGroup.vertices; i++) {
        const offset = i * 3;
        vertices.push({
            x: geoGroup.vertexArray[offset],
            y: geoGroup.vertexArray[offset + 1],
            z: geoGroup.vertexArray[offset + 2],
        });
        if (geoGroup.normalArray)
            normals.push({
                x: geoGroup.normalArray[offset],
                y: geoGroup.normalArray[offset + 1],
                z: geoGroup.normalArray[offset + 2],
            });
        if (geoGroup.colorArray)
            colors.push({
                r: geoGroup.colorArray[offset],
                g: geoGroup.colorArray[offset + 1],
                b: geoGroup.colorArray[offset + 2],
            });
    }
    let processedData: ProcessedGeometryData = {
        vertices,
        normals,
        colors,
        faces: Array.from(geoGroup.faceArray.slice(0, geoGroup.faceidx)),
    };

    // Step 1: Apply orphan vertex removal if requested
    if (options.removeOrphanVertexes) {
        processedData = removeOrphanVertices(processedData);
    }

    // Step 2: Apply simplification if requested for surfaces
    if (geometry.isSurface && options.simplifySurfaces) {
        // Merge vertices with a small tolerance to stitch seams before simplification
        processedData = mergeVertices(processedData, 1e-3, true);
        const ratio =
            options.simplifySurfaces === true
                ? 0.5
                : parseFloat(options.simplifySurfaces as any);
        if (typeof ratio === "number" && ratio > 0 && ratio < 1) {
            processedData = simplifyMesh(processedData, ratio);
            // Remove isolated vertices that may have been created during simplification
            processedData = removeIsolatedVertices(processedData);
            // Recompute normals after simplification
            processedData = recomputeNormalsForProcessedData(processedData);

            // Merge vertices again to clean up seams
            processedData = mergeVertices(processedData, 1e-3, true);
        }
    }

    // Step 3: Apply smoothing if requested
    if (options.smoothSurfaces) {
        const iterations =
            options.smoothSurfaces === true
                ? 1
                : parseInt(options.smoothSurfaces as any);
        if (iterations > 0) {
            processedData = laplacianSmooth(processedData, iterations);
        }
    }

    // Step 4: Standard vertex merging (regardless of simplifying)
    if (options.mergeVertices) {
        processedData = mergeVertices(processedData, options.mergeVertices);
        // Recompute normals after merging
        processedData = recomputeNormalsForProcessedData(processedData);
    }

    // Step 5: Generate the VRML string from the final processed data
    return _generateFaceSetVRML(processedData, options, indent);
}

/**
 * Private helper to generate the IndexedFaceSet VRML string from processed data.
 */
function _generateFaceSetVRML(
    data: ProcessedGeometryData,
    options: VRMLExportOptions,
    indent: string
): string {
    let output = indent + "geometry IndexedFaceSet {\n";
    const geoIndent = indent + "  ";
    output += geoIndent + "solid FALSE\n";

    // Coordinates
    output += geoIndent + "coord Coordinate {\n" + geoIndent + "  point [\n";
    for (const v of data.vertices) {
        output += `${geoIndent}    ${formatCoord(
            v.x,
            options.precision
        )} ${formatCoord(v.y, options.precision)} ${formatCoord(
            v.z,
            options.precision
        )},\n`;
    }
    output += geoIndent + "  ]\n" + geoIndent + "}\n";

    // Normals
    if (data.normals.length > 0) {
        output += geoIndent + "normalPerVertex TRUE\n";
        output += geoIndent + "normal Normal {\n" + geoIndent + "  vector [\n";
        for (const n of data.normals) {
            output += `${geoIndent}    ${formatCoord(
                n.x,
                options.precision
            )} ${formatCoord(n.y, options.precision)} ${formatCoord(
                n.z,
                options.precision
            )},\n`;
        }
        output += geoIndent + "  ]\n" + geoIndent + "}\n";
    } else {
        output += geoIndent + "normalPerVertex FALSE\n";
    }

    // Colors
    if (data.colors.length > 0) {
        output += geoIndent + "colorPerVertex TRUE\n";
        output += geoIndent + "color Color {\n" + geoIndent + "  color [\n";
        for (const c of data.colors) {
            output += `${geoIndent}    ${formatCoord(
                c.r,
                options.precision
            )} ${formatCoord(c.g, options.precision)} ${formatCoord(
                c.b,
                options.precision
            )},\n`;
        }
        output += geoIndent + "  ]\n" + geoIndent + "}\n";
    } else {
        output += geoIndent + "colorPerVertex FALSE\n";
    }

    // Face Indices
    if (data.faces.length > 0) {
        output += geoIndent + "coordIndex [\n";
        for (let i = 0; i < data.faces.length; i += 3) {
            output += `${geoIndent}  ${data.faces[i]}, ${data.faces[i + 1]}, ${
                data.faces[i + 2]
            }, -1,\n`;
        }
        output += geoIndent + "]\n";
    }

    output += indent + "}\n";
    return output;
}
