/** WebGL2 프로그램과 점 메시 생성. */

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;

  gl.deleteShader(shader);
  return null;
}

export function createProgram(gl, vertexSource, fragmentSource) {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;

  gl.deleteProgram(program);
  return null;
}

/** 이름 목록으로 uniform 위치를 모은다. 셰이더가 쓰지 않아 제거된 이름은 null이다. */
export function getUniforms(gl, program, names) {
  return Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
}

/** aPos(location 0, vec3) + aSeed(location 1, vec4) 정점 배열을 올린다. */
export function createPointMesh(gl, data, floatsPerPoint) {
  const vertexArray = gl.createVertexArray();
  const buffer = gl.createBuffer();
  const stride = floatsPerPoint * Float32Array.BYTES_PER_ELEMENT;
  const count = data.length / floatsPerPoint;

  gl.bindVertexArray(vertexArray);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 4, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
  gl.bindVertexArray(null);

  return {
    draw() {
      gl.bindVertexArray(vertexArray);
      gl.drawArrays(gl.POINTS, 0, count);
    }
  };
}
