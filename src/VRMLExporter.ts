import {
    Object3D,
    Geometry,
    GeometryGroup,
    LineBasicMaterial,
    Material,
} from "./WebGL";

/**
 * Options for VRML export to control optimizations.
 */
export interface VRMLExportOptions {
    /** If set, merge vertices within this distance. Default is no merging. */
    mergeVertices?: number;
    /** The number of decimal places for coordinates in the VRML file. */
    precision?: number;
    /** Quality of sphere rendering (default 2, higher increases number of triangles). */
    sphereQuality?: number;
    /** Number of subdivisions for cylinder rendering (default 4). Controls roundness. */
    cylinderSubdivisions?: number;
    /** Number of height segments for cylinder rendering (default 10). Controls smoothness along length. */
    cylinderHeightSegments?: number;
    /** Quality of cartoon rendering (default 10). */
    cartoonQuality?: number;
}

/**
 * A class for exporting a 3Dmol.js scene to VRML format.
 */
export class VRMLExporter {
    /**
     * Export a scene to a VRML string.
     * @param {Object3D} scene - The scene to export.
     * @param {VRMLExportOptions} [options={}] - Export options.
     * @returns {string} The VRML string.
     */
    public export(scene: Object3D, options: VRMLExportOptions = {}): string {
        let output = "#VRML V2.0 utf8\n";
        for (const child of scene.children) {
            output += this.parse(child, options, "");
        }
        return output;
    }

    public parse(
        object: Object3D,
        options: VRMLExportOptions,
        indent: string
    ): string {
        if (object.visible === false) return "";

        let content = "";
        const childIndent = indent + "  ";

        if (object.geometry) {
            content += this.parseGeometry(
                object.geometry,
                object.material,
                options,
                childIndent
            );
        }

        for (const child of object.children) {
            content += this.parse(child, options, childIndent);
        }

        if (content.trim() === "") {
            return "";
        }

        let output = indent + "Transform {\n";
        const transformPropertyIndent = indent + "  ";

        output +=
            transformPropertyIndent +
            "translation " +
            object.position.x +
            " " +
            object.position.y +
            " " +
            object.position.z +
            "\n";

        const rot = object.quaternion;
        let angle = 2 * Math.acos(rot.w);
        let axis = { x: rot.x, y: rot.y, z: rot.z };
        if (Math.abs(angle) > 1e-6) {
            const s = 1 / Math.sin(angle / 2);
            axis.x *= s;
            axis.y *= s;
            axis.z *= s;
        } else {
            axis = { x: 0, y: 1, z: 0 };
            angle = 0;
        }
        output +=
            transformPropertyIndent +
            "rotation " +
            axis.x +
            " " +
            axis.y +
            " " +
            axis.z +
            " " +
            angle +
            "\n";
        output +=
            transformPropertyIndent +
            "scale " +
            object.scale.x +
            " " +
            object.scale.y +
            " " +
            object.scale.z +
            "\n";

        output += transformPropertyIndent + "children [\n";
        output += content;
        output += transformPropertyIndent + "]\n";
        output += indent + "}\n";

        return output;
    }

    public parseGeometry(
        geometry: Geometry,
        material: Material,
        options: VRMLExportOptions,
        indent: string
    ): string {
        let output = "";
        for (const geoGroup of geometry.geometryGroups) {
            output += this.parseGeometryGroup(
                geoGroup,
                material,
                options,
                indent
            );
        }
        return output;
    }

    public parseGeometryGroup(
        geoGroup: GeometryGroup,
        material: Material,
        options: VRMLExportOptions,
        indent: string
    ): string {
        if (!geoGroup || geoGroup.vertices === 0) return "";

        let output = indent + "Shape {\n";
        const shapeIndent = indent + " ";
        output += shapeIndent + "appearance Appearance {\n";
        const appearanceIndent = shapeIndent + " ";
        output += appearanceIndent + "material Material {\n";
        const materialIndent = appearanceIndent + " ";
        if (material.color) {
            output +=
                materialIndent +
                "diffuseColor " +
                material.color.r +
                " " +
                material.color.g +
                " " +
                material.color.b +
                "\n";
        }
        if (material.wireframe && geoGroup.colorArray) {
            const c = geoGroup.colorArray;
            output +=
                materialIndent +
                "emissiveColor " +
                c[0] +
                " " +
                c[1] +
                " " +
                c[2] +
                "\n";
        }
        if (material.transparent) {
            output +=
                materialIndent +
                "transparency " +
                (1.0 - material.opacity) +
                "\n";
        }
        output += appearanceIndent + "}\n";
        output += shapeIndent + "}\n";

        if (material instanceof LineBasicMaterial || material.wireframe) {
            output += this.generateIndexedLineSet(
                geoGroup,
                material,
                options,
                shapeIndent
            );
        } else {
            output += this.generateIndexedFaceSet(
                geoGroup,
                options,
                shapeIndent
            );
        }
        output += indent + "}\n";

        return output;
    }

    public formatCoord(val: number, precision?: number): string {
        if (precision !== undefined) {
            return val.toFixed(precision);
        }
        return val.toString();
    }

    public generateIndexedLineSet(
        geoGroup: GeometryGroup,
        material: Material,
        options: VRMLExportOptions,
        indent: string
    ): string {
        let output = indent + "geometry IndexedLineSet {\n";
        const geoIndent = indent + " ";

        output += geoIndent + "colorPerVertex TRUE\n";
        output += geoIndent + "coord Coordinate {\n";
        output += geoIndent + " point [\n";
        for (let i = 0; i < geoGroup.vertices; ++i) {
            const offset = i * 3;
            const x = this.formatCoord(
                geoGroup.vertexArray?.[offset],
                options.precision
            );
            const y = this.formatCoord(
                geoGroup.vertexArray?.[offset + 1],
                options.precision
            );
            const z = this.formatCoord(
                geoGroup.vertexArray?.[offset + 2],
                options.precision
            );
            output += geoIndent + "  " + x + " " + y + " " + z + ",\n";
        }
        output += geoIndent + " ]\n";
        output += geoIndent + "}\n";

        if (geoGroup.colorArray && !material.wireframe) {
            output += geoIndent + "color Color {\n";
            output += geoIndent + " color [\n";
            for (let i = 0; i < geoGroup.vertices; ++i) {
                const offset = i * 3;
                const r = geoGroup.colorArray[offset];
                const g = geoGroup.colorArray[offset + 1];
                const b = geoGroup.colorArray[offset + 2];
                output += geoIndent + "  " + r + " " + g + " " + b + ",\n";
            }
            output += geoIndent + " ]\n";
            output += geoIndent + "}\n";
        }

        output += geoIndent + "coordIndex [\n";
        if (material.wireframe && geoGroup.faceArray) {
            for (let i = 0; i < geoGroup.faceidx; i += 3) {
                const x = geoGroup.faceArray?.[i];
                const y = geoGroup.faceArray?.[i + 1];
                const z = geoGroup.faceArray?.[i + 2];
                output += geoIndent + " " + x + ", " + y + ", " + z + ", -1,\n";
            }
        } else {
            for (let i = 0; i < geoGroup.vertices - 1; i += 2) {
                output += geoIndent + " " + i + ", " + (i + 1) + ", -1,\n";
            }
        }
        output += geoIndent + "]\n";
        output += indent + "}\n";
        return output;
    }

    public generateIndexedFaceSet(
        geoGroup: GeometryGroup,
        options: VRMLExportOptions,
        indent: string
    ): string {
        const mergeDist = options.mergeVertices;
        if (typeof mergeDist === "number" && mergeDist > 0) {
            return this.generateMergedIndexedFaceSet(geoGroup, options, indent);
        }
        return this.generateUnmergedIndexedFaceSet(geoGroup, options, indent);
    }

    public generateUnmergedIndexedFaceSet(
        geoGroup: GeometryGroup,
        options: VRMLExportOptions,
        indent: string
    ): string {
        let output = indent + "geometry IndexedFaceSet {\n";
        const geoIndent = indent + " ";

        output += geoIndent + "colorPerVertex TRUE\n";
        output += geoIndent + "normalPerVertex TRUE\n";
        output += geoIndent + "solid FALSE\n";

        // Vertices
        output += geoIndent + "coord Coordinate {\n" + geoIndent + " point [\n";
        for (let i = 0; i < geoGroup.vertices; ++i) {
            const offset = i * 3;
            const x = this.formatCoord(
                geoGroup.vertexArray?.[offset],
                options.precision
            );
            const y = this.formatCoord(
                geoGroup.vertexArray?.[offset + 1],
                options.precision
            );
            const z = this.formatCoord(
                geoGroup.vertexArray?.[offset + 2],
                options.precision
            );
            output += geoIndent + "  " + x + " " + y + " " + z + ",\n";
        }
        output += geoIndent + " ]\n" + geoIndent + "}\n";

        // Normals
        output += geoIndent + "normal Normal {\n" + geoIndent + " vector [\n";
        for (let i = 0; i < geoGroup.vertices; ++i) {
            const offset = i * 3;
            const x = this.formatCoord(
                geoGroup.normalArray?.[offset],
                options.precision
            );
            const y = this.formatCoord(
                geoGroup.normalArray?.[offset + 1],
                options.precision
            );
            const z = this.formatCoord(
                geoGroup.normalArray?.[offset + 2],
                options.precision
            );
            output += geoIndent + "  " + x + " " + y + " " + z + ",\n";
        }
        output += geoIndent + " ]\n" + geoIndent + "}\n";

        // Colors
        if (geoGroup.colorArray) {
            output += geoIndent + "color Color {\n" + geoIndent + " color [\n";
            for (let i = 0; i < geoGroup.vertices; ++i) {
                const offset = i * 3;
                output +=
                    geoIndent +
                    "  " +
                    geoGroup.colorArray[offset] +
                    " " +
                    geoGroup.colorArray[offset + 1] +
                    " " +
                    geoGroup.colorArray[offset + 2] +
                    ",\n";
            }
            output += geoIndent + " ]\n" + geoIndent + "}\n";
        }

        // Faces
        output += geoIndent + "coordIndex [\n";
        for (let i = 0; i < geoGroup.faceidx; i += 3) {
            const x = geoGroup.faceArray?.[i];
            const y = geoGroup.faceArray?.[i + 1];
            const z = geoGroup.faceArray?.[i + 2];
            output += geoIndent + " " + x + ", " + y + ", " + z + ", -1,\n";
        }
        output += geoIndent + "]\n";
        output += indent + "}\n";
        return output;
    }

    public generateMergedIndexedFaceSet(
        geoGroup: GeometryGroup,
        options: VRMLExportOptions,
        indent: string
    ): string {
        const mergeDist = options.mergeVertices as number;
        const mergeDistSq = mergeDist * mergeDist;

        const newVertices: { x: number; y: number; z: number }[] = [];
        const newNormals: { x: number; y: number; z: number; count: number }[] =
            [];
        const newColors: { r: number; g: number; b: number }[] = [];
        const oldToNewMap = new Int32Array(geoGroup.vertices).fill(-1);

        const grid: { [key: string]: number[] } = {};
        const cellSize = mergeDist;

        for (let i = 0; i < geoGroup.vertices; i++) {
            const offset = i * 3;
            const vx = geoGroup.vertexArray[offset];
            const vy = geoGroup.vertexArray[offset + 1];
            const vz = geoGroup.vertexArray[offset + 2];

            let r = 0,
                g = 0,
                b = 0;
            if (geoGroup.colorArray) {
                r = geoGroup.colorArray[offset];
                g = geoGroup.colorArray[offset + 1];
                b = geoGroup.colorArray[offset + 2];
            }

            const gx = Math.floor(vx / cellSize);
            const gy = Math.floor(vy / cellSize);
            const gz = Math.floor(vz / cellSize);

            let found = false;

            for (let dx = -1; dx <= 1 && !found; dx++) {
                for (let dy = -1; dy <= 1 && !found; dy++) {
                    for (let dz = -1; dz <= 1 && !found; dz++) {
                        const gridKey = `${gx + dx},${gy + dy},${gz + dz}`;
                        if (grid[gridKey]) {
                            const cell = grid[gridKey];
                            for (const newIndex of cell) {
                                const nv = newVertices[newIndex];
                                const nc = newColors[newIndex];

                                const xdiff = vx - nv.x;
                                if (Math.abs(xdiff) > mergeDist) continue;
                                const ydiff = vy - nv.y;
                                if (Math.abs(ydiff) > mergeDist) continue;
                                const zdiff = vz - nv.z;
                                if (Math.abs(zdiff) > mergeDist) continue;

                                const distSq =
                                    xdiff * xdiff +
                                    ydiff * ydiff +
                                    zdiff * zdiff;

                                if (distSq < mergeDistSq) {
                                    if (geoGroup.colorArray) {
                                        const dr = r - nc.r;
                                        const dg = g - nc.g;
                                        const db = b - nc.b;
                                        if (
                                            dr * dr + dg * dg + db * db >
                                            1e-6
                                        ) {
                                            continue;
                                        }
                                    }
                                    oldToNewMap[i] = newIndex;
                                    if (geoGroup.normalArray) {
                                        newNormals[newIndex].x +=
                                            geoGroup.normalArray[offset];
                                        newNormals[newIndex].y +=
                                            geoGroup.normalArray[offset + 1];
                                        newNormals[newIndex].z +=
                                            geoGroup.normalArray[offset + 2];
                                        newNormals[newIndex].count++;
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
                newVertices.push({ x: vx, y: vy, z: vz });
                if (geoGroup.normalArray) {
                    newNormals.push({
                        x: geoGroup.normalArray[offset],
                        y: geoGroup.normalArray[offset + 1],
                        z: geoGroup.normalArray[offset + 2],
                        count: 1,
                    });
                }
                if (geoGroup.colorArray) {
                    newColors.push({ r, g, b });
                }

                const gridKey = `${gx},${gy},${gz}`;
                if (!grid[gridKey]) grid[gridKey] = [];
                grid[gridKey].push(newIndex);
            }
        }

        for (const n of newNormals) {
            const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
            if (len > 0) {
                n.x /= len;
                n.y /= len;
                n.z /= len;
            }
        }

        const faceArray = geoGroup.faceArray;
        const newFaceArray = new Uint16Array(faceArray.length);
        for (let i = 0; i < faceArray.length; i++) {
            newFaceArray[i] = oldToNewMap[faceArray[i]];
        }

        let output = indent + "geometry IndexedFaceSet {\n";
        const geoIndent = indent + " ";
        output += geoIndent + "colorPerVertex TRUE\n";
        output += geoIndent + "normalPerVertex TRUE\n";
        output += geoIndent + "solid FALSE\n";

        output += geoIndent + "coord Coordinate {\n" + geoIndent + " point [\n";
        for (const v of newVertices) {
            output +=
                geoIndent +
                "  " +
                this.formatCoord(v.x, options.precision) +
                " " +
                this.formatCoord(v.y, options.precision) +
                " " +
                this.formatCoord(v.z, options.precision) +
                ",\n";
        }
        output += geoIndent + " ]\n" + geoIndent + "}\n";

        if (newNormals.length > 0) {
            output +=
                geoIndent + "normal Normal {\n" + geoIndent + " vector [\n";
            for (const n of newNormals) {
                output +=
                    geoIndent +
                    "  " +
                    this.formatCoord(n.x, options.precision) +
                    " " +
                    this.formatCoord(n.y, options.precision) +
                    " " +
                    this.formatCoord(n.z, options.precision) +
                    ",\n";
            }
            output += geoIndent + " ]\n" + geoIndent + "}\n";
        }

        if (newColors.length > 0) {
            output += geoIndent + "color Color {\n" + geoIndent + " color [\n";
            for (const c of newColors) {
                output +=
                    geoIndent + "  " + c.r + " " + c.g + " " + c.b + ",\n";
            }
            output += geoIndent + " ]\n" + geoIndent + "}\n";
        }

        output += geoIndent + "coordIndex [\n";
        for (let i = 0; i < newFaceArray.length; i += 3) {
            output +=
                geoIndent +
                " " +
                newFaceArray[i] +
                ", " +
                newFaceArray[i + 1] +
                ", " +
                newFaceArray[i + 2] +
                ", -1,\n";
        }
        output += geoIndent + "]\n";
        output += indent + "}\n";

        return output;
    }
}
