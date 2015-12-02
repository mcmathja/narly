'use strict'

var gulp = require('gulp')
var browserify = require('browserify')
var babelify = require('babelify')
var source = require('vinyl-source-stream')
var buffer = require('vinyl-buffer')
var uglify = require('gulp-uglify')
var rename = require('gulp-rename')

gulp.task('dev', () => {
  return browserify({
    entries: 'src/Narly.js',
    extensions: '.js',
    standalone: 'Narly'
  })
  .transform(babelify.configure({
    plugins: [
      ['babel-plugin-transform-es2015-classes', {'loose': true}],
      ['babel-plugin-transform-es2015-modules-umd', {'loose': true}],
      ['babel-plugin-transform-es2015-computed-properties', {'loose': true}],
      ['babel-plugin-transform-es2015-block-scoping', {'loose': true}],
      ['babel-plugin-transform-es2015-arrow-functions']
    ]
  }))
  .bundle()
  .pipe(source('narly.js'))
  .pipe(gulp.dest('dist/'))
})

gulp.task('prod', ['dev'], () => {
  gulp.src('dist/narly.js')
  .pipe(uglify())
  .pipe(rename({ extname: '.min.js' }))
  .pipe(gulp.dest('dist/'))
})

gulp.task('build', ['prod'])
gulp.task('default', ['build'])