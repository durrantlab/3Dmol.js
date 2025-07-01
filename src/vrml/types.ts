// vrml/types.ts

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
    /** If true, remove any vertices not part of a face. */
    removeOrphanVertexes?: boolean;
    /** If true, removes extra whitespace in the output. */
    minimizeWhiteSpace?: boolean;
}

/**
 * A standardized data structure for holding geometry data during processing.
 */
export interface ProcessedGeometryData {
    vertices: { x: number; y: number; z: number }[];
    normals: { x: number; y: number; z: number }[];
    colors: { r: number; g: number; b: number }[];
    faces: number[];
}