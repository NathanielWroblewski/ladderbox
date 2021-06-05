import Vector from './models/vector.js'
import FourByFour from './models/four_by_four.js'
import Camera from './models/orthographic.js'
import angles from './isomorphisms/angles.js'
import coordinates from './isomorphisms/coordinates.js'
import renderLine from './views/line.js'
import renderCircle from './views/circle.js'
import renderPolygon from './views/polygon.js'
import { seed, noise } from './utilities/noise.js'
import { stableSort, remap } from './utilities/index.js'
import { COLORS, BLACK } from './constants/colors.js'
import {
  ZOOM, FPS, Δt, CUBE_FACES, Z_AXIS, PERIOD, FRAMES, Δy
} from './constants/dimensions.js'

// Copyright (c) 2020 Nathaniel Wroblewski
// I am making my contributions/submissions to this project solely in my personal
// capacity and am not conveying any rights to any intellectual property of any
// third parties.

const canvas = document.querySelector('.canvas')
const context = canvas.getContext('2d')

const { sin, cos } = Math

const perspective = FourByFour.identity()
  .rotX(angles.toRadians(-20))
  .rotY(angles.toRadians(45))

const camera = new Camera({
  position: Vector.zeroes(),
  direction: Vector.zeroes(),
  up: Vector.from([0, 1, 0]),
  width: canvas.width,
  height: canvas.height,
  zoom: ZOOM
})

seed(Math.random())

const CUBE_VERTICES = [
  Vector.from([ 1,  1,  1]),
  Vector.from([-1,  1,  1]),
  Vector.from([ 1, -1,  1]),
  Vector.from([-1, -1,  1]),
  Vector.from([ 1,  1, -1]),
  Vector.from([-1,  1, -1]),
  Vector.from([ 1, -1, -1]),
  Vector.from([-1, -1, -1]),
]

const objects = []
const campos = Vector.from([0, 10, 100])
const light = campos

const renderComparator = (a, b) => {
  const a0 = campos.subtract(a.center.transform(perspective))
  const b0 = campos.subtract(b.center.transform(perspective))

  if (a0.z < b0.z) return -1
  if (a0.z > b0.z) return 1
  if (a0.x < b0.x) return -1
  if (a0.x > b0.x) return 1
  if (a0.y < b0.y) return -1
  if (a0.y > b0.y) return 1
  return 0
}

// one cube path different points in time

const translate = Vector.from([0, -Δy/PERIOD, 0])

const transforms = [
  { rotate: 0, about: () => Vector.zeroes(), translate },
  { rotate: 0, about: () => Vector.zeroes(), translate },
  { rotate: 0, about: () => Vector.zeroes(), translate },
  { rotate: -90, about: faces => faces[1].vertices[0], translate },
  { rotate: -90, about: faces => faces[1].vertices[0], translate },
  { rotate: -90, about: faces => faces[0].vertices[0], translate },
  { rotate: -90, about: faces => faces[3].vertices[0], translate },
  { rotate: -90, about: faces => faces[3].vertices[0], translate },
  { rotate: 0, about: () => Vector.zeroes(), translate },
  { rotate: 0, about: () => Vector.zeroes(), translate },
  { rotate: 0, about: () => Vector.zeroes(), translate },
  { rotate: 0, about: () => Vector.zeroes(), translate },
  { rotate: 90, about: faces => faces[1].vertices[0], translate },
  { rotate: 90, about: faces => faces[1].vertices[0], translate },
  { rotate: 90, about: faces => faces[2].vertices[0], translate },
  { rotate: 90, about: faces => faces[3].vertices[0], translate },
  { rotate: 90, about: faces => faces[3].vertices[0], translate },
  { rotate: 0, about: () => Vector.zeroes(), translate }
]

const states = []
const faces = []

CUBE_FACES.forEach(face => {
  const vertices = face.map(index => CUBE_VERTICES[index])
  const normal = vertices[1].subtract(vertices[0]).cross(vertices[2].subtract(vertices[1])).normalize()

  faces.push({
    type: 'polygon',
    center: vertices[2].subtract(vertices[0]).divide(2).add(vertices[0]),
    vertices,
    normal
  })
})

// compute the entire path of the box
for (let time = 0; time < transforms.length * FRAMES; time++) {
  const transformIndex = Math.floor(time / FRAMES)
  const { rotate, about, translate } = transforms[transformIndex]
  const polys = (states[time - 1] || faces)

  states[time] = polys.map(face => ({
    ...face,
    vertices: face.vertices.map(vertex => {
      return vertex
        .rotateAround(about(polys), Z_AXIS, angles.toRadians(rotate/FRAMES))
        .add(translate.divide(FRAMES))
    }),
    center: face.center
        .rotateAround(about(polys), Z_AXIS, angles.toRadians(rotate/FRAMES))
        .add(translate.divide(FRAMES))
  }))
}

// render the single box on its path at three different times of its path
let times = [0, FRAMES * 3, FRAMES * 6]

const render = () => {
  context.clearRect(0, 0, canvas.width, canvas.height)

  perspective.rotY(angles.toRadians(0.5))

  const polys = times.reduce((memo, time) => memo.concat(states[time]), [])

  stableSort(polys, renderComparator).forEach(face => {
    const ray = light.subtract(face.center).normalize()
    const facingRatio = face.normal.dot(ray)
    const colorIndex = Math.floor(remap(facingRatio, [-0.003, 0.003], [0, COLORS.length - 1]))
    const color = COLORS[colorIndex]
    const projected = face.vertices.map(vertex => {
      return camera.project(vertex.transform(perspective))
    })

    renderPolygon(context, projected, BLACK, color)
  })

  times = times.map(time => time === (transforms.length * FRAMES - 1) ? 0 : time += Δt)
}

let prevTick = 0

const step = () => {
  window.requestAnimationFrame(step)

  const now = Math.round(FPS * Date.now() / 1000)
  if (now === prevTick) return
  prevTick = now

  render()
}

step()
