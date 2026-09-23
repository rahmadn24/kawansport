if(NOT TARGET fbjni::fbjni)
add_library(fbjni::fbjni SHARED IMPORTED)
set_target_properties(fbjni::fbjni PROPERTIES
    IMPORTED_LOCATION "/Users/macintoshhd/.gradle/caches/transforms-3/d24b1709d46536081311594eb088200c/transformed/fbjni-0.5.1/prefab/modules/fbjni/libs/android.arm64-v8a/libfbjni.so"
    INTERFACE_INCLUDE_DIRECTORIES "/Users/macintoshhd/.gradle/caches/transforms-3/d24b1709d46536081311594eb088200c/transformed/fbjni-0.5.1/prefab/modules/fbjni/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

