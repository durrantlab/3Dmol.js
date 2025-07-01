// vrml/VRMLExporter.ts

import {
    Object3D,
    Geometry,
    GeometryGroup,
    LineBasicMaterial,
    Material,
} from "../WebGL";
import { VRMLExportOptions } from "./types";
import { formatCoord } from "./utils";
import { generateIndexedFaceSetString, generateIndexedLineSetString } from "./generators";
import { minimizeWhiteSpace } from "./optimizers";

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

        if (options.minimizeWhiteSpace) {
            // Remove extra whitespace if requested
            output = minimizeWhiteSpace(output);
        }

        return output;
    }

    /**
     * Recursively parses an Object3D node and its children.
     */
    public parse(object: Object3D, options: VRMLExportOptions, indent: string): string {
        if (object.visible === false) return "";

        let content = "";
        const childIndent = indent + "  ";

        if (object.geometry) {
            content += this.parseGeometry(object.geometry, object.material, options, childIndent);
        }

        for (const child of object.children) {
            content += this.parse(child, options, childIndent);
        }

        if (content.trim() === "") return "";

        let output = indent + "Transform {\n";
        const propIndent = indent + "  ";

        // Translation
        output += `${propIndent}translation ${object.position.x} ${object.position.y} ${object.position.z}\n`;

        // Rotation (from quaternion)
        const rot = object.quaternion;
        let angle = 2 * Math.acos(rot.w);
        let axis = { x: rot.x, y: rot.y, z: rot.z };
        if (Math.abs(angle) > 1e-6) {
            const s = 1 / Math.sin(angle / 2);
            axis = { x: rot.x * s, y: rot.y * s, z: rot.z * s };
        } else {
            axis = { x: 0, y: 1, z: 0 };
            angle = 0;
        }
        output += `${propIndent}rotation ${axis.x} ${axis.y} ${axis.z} ${angle}\n`;
        
        // Scale
        output += `${propIndent}scale ${object.scale.x} ${object.scale.y} ${object.scale.z}\n`;

        output += propIndent + "children [\n";
        output += content;
        output += propIndent + "]\n";
        output += indent + "}\n";

        return output;
    }
    
    /**
     * Parses the geometry of an object.
     */
    private parseGeometry(geometry: Geometry, material: Material, options: VRMLExportOptions, indent: string): string {
        let output = "";
        for (const geoGroup of geometry.geometryGroups) {
            output += this.parseGeometryGroup(geoGroup, material, options, indent);
        }
        return output;
    }

    /**
     * Parses a single geometry group into a VRML Shape node.
     */
    private parseGeometryGroup(geoGroup: GeometryGroup, material: Material, options: VRMLExportOptions, indent: string): string {
        if (!geoGroup || geoGroup.vertices === 0) return "";

        let output = indent + "Shape {\n";
        const shapeIndent = indent + "  ";
        
        // Appearance and Material
        output += shapeIndent + "appearance Appearance {\n";
        const appearanceIndent = shapeIndent + "  ";
        output += appearanceIndent + "material Material {\n";
        const materialIndent = appearanceIndent + "  ";
        if (material.color) {
            output += `${materialIndent}diffuseColor ${formatCoord(material.color.r, options.precision)} ${formatCoord(material.color.g, options.precision)} ${formatCoord(material.color.b, options.precision)}\n`;
        }
        if (material.wireframe && geoGroup.colorArray) {
            output += `${materialIndent}emissiveColor ${formatCoord(geoGroup.colorArray[0], options.precision)} ${formatCoord(geoGroup.colorArray[1], options.precision)} ${formatCoord(geoGroup.colorArray[2], options.precision)}\n`;
        }
        if (material.transparent) {
            output += `${materialIndent}transparency ${1.0 - material.opacity}\n`;
        }
        output += appearanceIndent + "}\n";
        output += shapeIndent + "}\n";

        // Geometry Node (delegated to generators)
        if (material instanceof LineBasicMaterial || material.wireframe) {
            output += generateIndexedLineSetString(geoGroup, material, options, shapeIndent);
        } else {
            output += generateIndexedFaceSetString(geoGroup, options, shapeIndent);
        }
        output += indent + "}\n";

        return output;
    }
}